import { NextRequest, NextResponse } from 'next/server';
import { resolveBackendUrl } from '@/lib/backend-url';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function proxyRequest(request: NextRequest, pathSegments: string[]) {
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
    const contentType = response.headers.get('content-type') ?? 'application/json';
    const isText =
      contentType.startsWith('text/') ||
      contentType.includes('json') ||
      contentType.includes('javascript') ||
      contentType.includes('xml') ||
      contentType.includes('svg');
    const body = isText ? await response.text() : await response.arrayBuffer();

    const responseHeaders = new Headers({ 'content-type': contentType });
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
        message: 'Backend indisponivel. Configure BACKEND_INTERNAL_URL no servico frontend do Railway.',
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

export async function GET(request: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  return proxyRequest(request, path);
}

export async function POST(request: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  return proxyRequest(request, path);
}

export async function PUT(request: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  return proxyRequest(request, path);
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  return proxyRequest(request, path);
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  return proxyRequest(request, path);
}
