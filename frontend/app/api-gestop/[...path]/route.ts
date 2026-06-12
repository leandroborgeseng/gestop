import { createProxyHandlers, proxyRouteConfig } from '@/lib/backend-proxy';

export const runtime = proxyRouteConfig.runtime;
export const dynamic = proxyRouteConfig.dynamic;

/** Alias legado — mantido ate todos os clientes usarem /api-sigma. */
export const { GET, POST, PUT, PATCH, DELETE } = createProxyHandlers();
