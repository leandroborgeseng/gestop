import { createProxyHandlers } from '@/lib/backend-proxy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const { GET, POST, PUT, PATCH, DELETE } = createProxyHandlers();
