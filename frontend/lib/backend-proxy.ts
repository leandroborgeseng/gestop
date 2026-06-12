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
    console.log(`[SIGMA:proxy] ${request.method} ${targetUrl}`);
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
    console.error(`[SIGMA:proxy] Falha ao conectar em ${targetUrl}: ${message}`);

    return NextResponse.json(
      {
        message:
          'Backend indisponivel. No Railway (servico frontend), defina BACKEND_INTERNAL_URL=http://${{gestop.RAILWAY_PRIVATE_DOMAIN}}:${{gestop.BACKEND_LISTEN_PORT}} e confirme que o servico gestop esta Running.',
        backendUrl,
        targetUrl,
        error: message,
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
