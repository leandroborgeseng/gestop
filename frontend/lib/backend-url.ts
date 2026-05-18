export function resolveBackendUrl() {
  const candidates = [
    process.env.BACKEND_INTERNAL_URL,
    process.env.GESTOP_BACKEND_URL,
    process.env.RAILWAY_SERVICE_GESTOP_URL,
  ].filter(Boolean) as string[];

  if (candidates.length > 0) {
    return candidates[0].replace(/\/$/, '');
  }

  const port = process.env.BACKEND_PORT ?? process.env.PORT ?? '8080';
  return `http://gestop.railway.internal:${port}`;
}
