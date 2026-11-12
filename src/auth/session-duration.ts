import { createHash } from 'node:crypto';

export const SESSAO_CURTA_SEGUNDOS = 60 * 60 * 8;
/** Teto absoluto da sessão "manter conectado": 30 dias desde o login original. */
export const SESSAO_LONGA_SEGUNDOS = 60 * 60 * 24 * 30;

/**
 * Quanto o refresh ainda pode emitir.
 * A sessão curta (8 h) repete 8 h. A longa nunca passa de `auth_time` + 30 dias.
 * Zero significa que o teto já passou e o refresh deve responder 401.
 */
export function duracaoRenovacaoSegundos(
  payload: { iat?: number; exp?: number; auth_time?: number },
  agoraSegundos = Math.floor(Date.now() / 1000),
) {
  const loginEm = payload.auth_time ?? payload.iat ?? agoraSegundos;
  const restante = loginEm + SESSAO_LONGA_SEGUNDOS - agoraSegundos;
  if (restante <= 0) return 0;
  const vida = (payload.exp ?? 0) - (payload.iat ?? 0);
  const base = vida >= 60 * 60 * 24 ? SESSAO_LONGA_SEGUNDOS : SESSAO_CURTA_SEGUNDOS;
  return Math.min(base, restante);
}

/** sha256 do access token, em hex. Identifica token legado, sem `sid`, no logout. */
export function hashDoToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Chave da sessão no LogAuditoria.
 * Com `sid`, o logout derruba só essa sessão. Sem `sid`, só o token apresentado.
 */
export function identificadorDeSessao(payload: { sid?: string | null }, tokenBruto?: string | null) {
  if (payload.sid) return payload.sid;
  if (!tokenBruto) return null;
  return hashDoToken(tokenBruto);
}
