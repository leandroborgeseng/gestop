import { NextRequest, NextResponse } from 'next/server';
import { resolveBackendUrl } from '@/lib/backend-url';

const PROXY_RETRY_ATTEMPTS = 3;
const PROXY_RETRY_DELAY_MS = 400;

function isBinaryExportPath(path: string) {
  return /\.(xlsx|pdf)$/i.test(path);
}

function isSpreadsheetContentType(contentType: string) {
  const normalized = contentType.toLowerCase();
  return (
    normalized.includes('spreadsheetml') ||
    normalized.includes('application/vnd.ms-excel') ||
    normalized.includes('application/octet-stream')
  );
}

function shouldProxyAsText(path: string, contentType: string) {
  if (isBinaryExportPath(path)) return false;
  if (isSpreadsheetContentType(contentType)) return false;
  if (contentType.toLowerCase().includes('application/pdf')) return false;

  return (
    contentType.startsWith('text/') ||
    contentType.includes('json') ||
    contentType.includes('javascript') ||
    contentType.includes('xml') ||
    contentType.includes('svg')
  );
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchBackend(targetUrl: string, init: RequestInit) {
  let lastError: unknown;

  for (let attempt = 1; attempt <= PROXY_RETRY_ATTEMPTS; attempt++) {
    try {
      return await fetch(targetUrl, init);
    } catch (error) {
      lastError = error;
      if (attempt < PROXY_RETRY_ATTEMPTS) {
        console.warn(
          `[SIGMA:proxy] Tentativa ${attempt}/${PROXY_RETRY_ATTEMPTS} falhou (${targetUrl}): ${
            error instanceof Error ? error.message : 'erro desconhecido'
          }`,
        );
        await sleep(PROXY_RETRY_DELAY_MS * attempt);
      }
    }
  }

  throw lastError;
}

export async function proxyToBackend(request: NextRequest, pathSegments: string[]) {
  const backendUrl = resolveBackendUrl();
  const path = pathSegments.join('/');
  const targetUrl = `${backendUrl}/${path}${request.nextUrl.search}`;

  const headers = new Headers();
  const contentType = request.headers.get('content-type');
  const authorization = request.headers.get('authorization');

  if (contentType) {
    headers.set('content-type', contentType);
  }

  if (authorization) {
    headers.set('authorization', authorization);
  }

  const init: RequestInit = {
    method: request.method,
    headers,
    cache: 'no-store',
  };

  if (!['GET', 'HEAD'].includes(request.method)) {
    init.body = await request.text();
  }

  try {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[SIGMA:proxy] ${request.method} ${targetUrl}`);
    }
    const response = await fetchBackend(targetUrl, init);
    const responseContentType = response.headers.get('content-type') ?? 'application/json';
    const isText = shouldProxyAsText(path, responseContentType);
    const body = isText ? await response.text() : await response.arrayBuffer();

    const responseHeaders = new Headers();
    if (isBinaryExportPath(path) && !response.headers.get('content-type')) {
      responseHeaders.set(
        'content-type',
        path.toLowerCase().endsWith('.xlsx')
          ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          : 'application/pdf',
      );
    } else {
      responseHeaders.set('content-type', responseContentType);
    }
    const contentDisposition = response.headers.get('content-disposition');
    if (contentDisposition) {
      responseHeaders.set('content-disposition', contentDisposition);
    }

    return new NextResponse(body, {
      status: response.status,
      headers: responseHeaders,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error(`[SIGMA:proxy] Falha ao conectar no backend: ${message}`);

    return NextResponse.json(
      {
        message:
          'Backend indisponível. Verifique se o serviço gestop está em execução e se BACKEND_INTERNAL_URL está configurado no frontend.',
      },
      { status: 502 },
    );
  }
}

type RouteContext = {
  params: Promise<{ path: string[] }>;
};

export function createProxyHandlers() {
  const handler = async (request: NextRequest, context: RouteContext) => {
    const { path } = await context.params;
    return proxyToBackend(request, path);
  };

  return {
    GET: handler,
    POST: handler,
    PUT: handler,
    PATCH: handler,
    DELETE: handler,
  };
}
