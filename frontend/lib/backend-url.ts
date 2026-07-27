function isUsableBackendUrl(value: string | undefined): value is string {
  if (!value?.trim()) {
    return false;
  }

  const normalized = value.trim();

  if (normalized.includes('${{')) {
    return false;
  }

  try {
    const parsed = new URL(normalized);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * URL do NestJS para o proxy server-side (/api-sigma e /api-gestop).
 *
 * Coolify (compose): BACKEND_INTERNAL_URL=http://api:3001
 * Railway: BACKEND_INTERNAL_URL=http://${{gestop.RAILWAY_PRIVATE_DOMAIN}}:${{gestop.PORT}}
 *
 * Nao use NEXT_PUBLIC_API_URL no browser — o proxy Next.js e o caminho suportado.
 */
export function resolveBackendUrl() {
  const explicit = [
    process.env.BACKEND_INTERNAL_URL,
    process.env.SIGMA_BACKEND_URL,
    process.env.GESTOP_BACKEND_URL,
    process.env.RAILWAY_SERVICE_GESTOP_URL,
  ].find(isUsableBackendUrl);

  if (explicit) {
    return explicit.trim().replace(/\/$/, '');
  }

  if (process.env.NODE_ENV !== 'production') {
    return `http://127.0.0.1:${process.env.BACKEND_PORT ?? '3001'}`;
  }

  // Compose Coolify: servico "api" na rede interna
  if (process.env.COOLIFY || process.env.COOLIFY_RESOURCE_UUID) {
    return `http://${process.env.BACKEND_PRIVATE_HOST ?? 'api'}:${process.env.BACKEND_SERVICE_PORT ?? '3001'}`;
  }

  const host = process.env.BACKEND_PRIVATE_HOST ?? 'gestop.railway.internal';
  const port = process.env.BACKEND_SERVICE_PORT ?? '8080';
  return `http://${host}:${port}`;
}

export function describeBackendUrlConfig() {
  const raw = process.env.BACKEND_INTERNAL_URL?.trim() ?? null;
  const usingFallback = !isUsableBackendUrl(process.env.BACKEND_INTERNAL_URL);

  return {
    backendUrl: resolveBackendUrl(),
    backendInternalUrl: raw,
    backendInternalUrlResolved: isUsableBackendUrl(process.env.BACKEND_INTERNAL_URL),
    usingFallback,
    nodeEnv: process.env.NODE_ENV ?? null,
  };
}
