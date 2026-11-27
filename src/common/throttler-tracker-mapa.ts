import { verifyJwt } from '../auth/jwt';
import { resolveJwtSecret } from '../config/env';
import { isUuid } from './uuid';

/**
 * O @Throttle getTracker roda no ThrottlerGuard global, antes do AuthGuard.
 * Sem verificar a assinatura, um token forjado com `sub` uuid aleatório
 * ganharia uma cota nova a cada requisição. O segredo vem de
 * resolveJwtSecret(); o controller do mapa aponta o ConfigService (mesma
 * fonte do AuthGuard), para as sondas que injetam o segredo só no ConfigService.
 */
let secretJwtDoTracker: (() => string) | null = null;

export function definirSecretJwtDoTracker(obter: (() => string) | null) {
  secretJwtDoTracker = obter;
}

export function secretJwtDoTrackerAtual() {
  return secretJwtDoTracker ? secretJwtDoTracker() : resolveJwtSecret();
}

/**
 * Chave do throttler para as rotas /mapa/camadas.
 * O front no Coolify chega pelo mesmo IP do proxy; o teto global de 120/min
 * por IP derrubava GET /mapa/camadas para todos os usuários. Com JWT válido
 * (assinatura e validade conferidas), a chave é o `sub` (uuid). Sem token
 * válido, cai no IP como o ThrottlerGuard padrão.
 */
export function trackerThrottlerMapaCamadas(req: Record<string, unknown>): string {
  const sub = subDoAuthorization(authorizationDoPedido(req));
  if (sub) return `sub:${sub}`;
  return ipDoPedido(req);
}

export function subDoAuthorization(authorization: string | null, secret = secretJwtDoTrackerAtual()): string | null {
  if (!authorization?.startsWith('Bearer ')) return null;
  const token = authorization.slice('Bearer '.length).trim();
  if (!token) return null;
  try {
    const payload = verifyJwt(token, secret);
    return typeof payload.sub === 'string' && isUuid(payload.sub.trim()) ? payload.sub.trim() : null;
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
