import { NextResponse } from 'next/server';

function resolveBackendUrl() {
  if (process.env.BACKEND_INTERNAL_URL) {
    return process.env.BACKEND_INTERNAL_URL.replace(/\/$/, '');
  }

  const port = process.env.BACKEND_PORT ?? '8080';
  return `http://gestop.railway.internal:${port}`;
}

export async function GET() {
  const backendUrl = resolveBackendUrl();

  try {
    const [healthResponse, dbResponse] = await Promise.all([
      fetch(`${backendUrl}/health`, { cache: 'no-store' }),
      fetch(`${backendUrl}/health/db`, { cache: 'no-store' }),
    ]);

    const health = await healthResponse.json();
    const db = await dbResponse.json();

    return NextResponse.json({
      status: 'ok',
      frontend: {
        nodeEnv: process.env.NODE_ENV ?? null,
        backendUrl,
      },
      backend: {
        health,
        db,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido';

    return NextResponse.json(
      {
        status: 'error',
        frontend: {
          nodeEnv: process.env.NODE_ENV ?? null,
          backendUrl,
        },
        message: 'Frontend nao conseguiu contatar o backend.',
        error: message,
      },
      { status: 502 },
    );
  }
}
