import { NextResponse } from 'next/server';
import { resolveBackendUrl } from '@/lib/backend-url';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const backendUrl = resolveBackendUrl();

  try {
    const [healthResponse, dbResponse] = await Promise.all([
      fetch(`${backendUrl}/health`, { cache: 'no-store' }),
      fetch(`${backendUrl}/health/db`, { cache: 'no-store' }),
    ]);

    const health = healthResponse.ok ? await healthResponse.json() : { status: healthResponse.status };
    const db = dbResponse.ok ? await dbResponse.json() : { status: dbResponse.status };

    return NextResponse.json({
      status: healthResponse.ok && dbResponse.ok ? 'ok' : 'degraded',
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
