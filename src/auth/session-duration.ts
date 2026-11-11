export const SESSAO_CURTA_SEGUNDOS = 60 * 60 * 8;
export const SESSAO_LONGA_SEGUNDOS = 60 * 60 * 24 * 30;

/** Sessão "manter conectado" dura 30 dias; a curta, 8 horas. A renovação repete a mesma duração. */
export function duracaoRenovacaoSegundos(payload: { iat?: number; exp?: number }) {
  const vida = (payload.exp ?? 0) - (payload.iat ?? 0);
  return vida >= 60 * 60 * 24 ? SESSAO_LONGA_SEGUNDOS : SESSAO_CURTA_SEGUNDOS;
}
