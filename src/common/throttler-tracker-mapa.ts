import { isUuid } from './uuid';

/**
 * Chave do throttler para as rotas /mapa/camadas.
 * O front no Coolify chega pelo mesmo IP do proxy; o teto global de 120/min
 * por IP derrubava GET /mapa/camadas para todos os usuários. Com JWT, a chave
 * é o `sub` (uuid). Sem token válido, cai no IP como o ThrottlerGuard padrão.
 */
export function trackerThrottlerMapaCamadas(req: Record<string, unknown>): string {
  const sub = subDoAuthorization(authorizationDoPedido(req));
  if (sub) return `sub:${sub}`;
  return ipDoPedido(req);
}

export function subDoAuthorization(authorization: string | null): string | null {
  if (!authorization?.startsWith('Bearer ')) return null;
  const payload = authorization.slice('Bearer '.length).split('.')[1];
  if (!payload) return null;
  try {
    const json = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { sub?: unknown };
    return typeof json.sub === 'string' && isUuid(json.sub.trim()) ? json.sub.trim() : null;
  } catch {
    return null;
  }
}

function authorizationDoPedido(req: Record<string, unknown>): string | null {
  const headers = req.headers as Record<string, string | string[] | undefined> | undefined;
  const value = headers?.authorization ?? headers?.Authorization;
  const raw = Array.isArray(value) ? value[0] : value;
  return raw ?? null;
}

function ipDoPedido(req: Record<string, unknown>): string {
  const ips = req.ips;
  if (Array.isArray(ips) && typeof ips[0] === 'string' && ips[0]) return ips[0];
  return typeof req.ip === 'string' && req.ip ? req.ip : 'anonymous';
}
