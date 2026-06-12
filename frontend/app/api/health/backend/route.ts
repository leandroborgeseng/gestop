import { NextResponse } from 'next/server';
import { describeBackendUrlConfig, resolveBackendUrl } from '@/lib/backend-url';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const backendUrl = resolveBackendUrl();
  const config = describeBackendUrlConfig();

  try {
    const [healthResponse, dbResponse, storageResponse] = await Promise.all([
      fetch(`${backendUrl}/health`, { cache: 'no-store' }),
      fetch(`${backendUrl}/health/db`, { cache: 'no-store' }),
      fetch(`${backendUrl}/health/storage`, { cache: 'no-store' }),
    ]);

    const health = healthResponse.ok ? await healthResponse.json() : { status: healthResponse.status };
    const db = dbResponse.ok ? await dbResponse.json() : { status: dbResponse.status };
    const storage = storageResponse.ok ? await storageResponse.json() : { status: storageResponse.status };

    const storageOk = storageResponse.ok && storage?.status !== 'error';

    return NextResponse.json({
      status: healthResponse.ok && dbResponse.ok && storageOk ? 'ok' : 'degraded',
      frontend: config,
      backend: {
        health,
        db,
        storage,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido';

    return NextResponse.json(
      {
        status: 'error',
        frontend: config,
        message: 'Frontend nao conseguiu contatar o backend.',
        error: message,
        hint: config.usingFallback
          ? 'Defina BACKEND_INTERNAL_URL no servico frontend do Railway e redeploy.'
          : 'Verifique se o servico gestop (backend) esta Running nos logs do Railway.',
      },
      { status: 502 },
    );
  }
}
