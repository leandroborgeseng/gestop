import { NextRequest, NextResponse } from 'next/server';
import { resolveBackendUrl } from '@/lib/backend-url';

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
    const response = await fetch(targetUrl, init);
    const responseContentType = response.headers.get('content-type') ?? 'application/json';
    const isText =
      responseContentType.startsWith('text/') ||
      responseContentType.includes('json') ||
      responseContentType.includes('javascript') ||
      responseContentType.includes('xml') ||
      responseContentType.includes('svg');
    const body = isText ? await response.text() : await response.arrayBuffer();

    const responseHeaders = new Headers({ 'content-type': responseContentType });
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
