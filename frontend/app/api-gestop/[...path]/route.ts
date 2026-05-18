import { NextRequest, NextResponse } from 'next/server';

function resolveBackendUrl() {
  if (process.env.BACKEND_INTERNAL_URL) {
    return process.env.BACKEND_INTERNAL_URL.replace(/\/$/, '');
  }

  const port = process.env.BACKEND_PORT ?? '8080';
  return `http://gestop.railway.internal:${port}`;
}

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
    console.log(`[GestOP:proxy] ${request.method} ${targetUrl}`);
    const response = await fetch(targetUrl, init);
    const body = await response.text();

    return new NextResponse(body, {
      status: response.status,
      headers: {
        'content-type': response.headers.get('content-type') ?? 'application/json',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error(`[GestOP:proxy] Falha ao conectar em ${targetUrl}: ${message}`);

    return NextResponse.json(
      {
        message: 'Backend indisponivel. Verifique BACKEND_INTERNAL_URL no servico frontend.',
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
