import { createProxyHandlers } from '@/lib/backend-proxy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Alias legado — mantido ate todos os clientes usarem /api-sigma. */
export const { GET, POST, PUT, PATCH, DELETE } = createProxyHandlers();
