import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Healthcheck leve para Coolify / orquestradores (sem depender do backend). */
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'sigma-web',
    timestamp: new Date().toISOString(),
  });
}
