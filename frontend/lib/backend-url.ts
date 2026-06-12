/**
 * URL do NestJS para o proxy server-side (/api-sigma).
 * Em producao no Railway, defina BACKEND_INTERNAL_URL no servico frontend:
 *   http://${{gestop.RAILWAY_PRIVATE_DOMAIN}}:${{gestop.PORT}}
 */
export function resolveBackendUrl() {
  const explicit = [
    process.env.BACKEND_INTERNAL_URL,
    process.env.SIGMA_BACKEND_URL,
    process.env.GESTOP_BACKEND_URL,
    process.env.RAILWAY_SERVICE_GESTOP_URL,
  ].find((value) => value?.trim());

  if (explicit?.trim()) {
    return explicit.trim().replace(/\/$/, '');
  }

  // Desenvolvimento local: Next (3000) → Nest (3001)
  if (process.env.NODE_ENV !== 'production') {
    return `http://127.0.0.1:${process.env.BACKEND_PORT ?? '3001'}`;
  }

  // Fallback rede privada Railway (hostname do servico backend)
  const host = process.env.BACKEND_PRIVATE_HOST ?? 'gestop.railway.internal';
  const port = process.env.BACKEND_SERVICE_PORT ?? '8080';
  return `http://${host}:${port}`;
}
