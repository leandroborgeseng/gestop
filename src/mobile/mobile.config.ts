/**
 * 303/304 — parâmetros de campo configuráveis por ambiente (sem migração).
 * - G2a/D2: precisão máxima aceita no check-in (m). `MOBILE_CHECKIN_PRECISAO_MAX_METROS`, padrão 50.
 * - O9/D3: validade do pacote offline (dias). `MOBILE_PACOTE_VALIDADE_DIAS`, padrão 7.
 */
export const PRECISAO_CHECKIN_PADRAO_METROS = 50;
export const VALIDADE_PACOTE_PADRAO_DIAS = 7;

function numeroPositivo(raw: string | undefined, padrao: number, max: number) {
  const n = Number(raw);
  return raw?.trim() && Number.isFinite(n) && n > 0 && n <= max ? n : padrao;
}

export function precisaoMaxCheckinMetros(env: NodeJS.ProcessEnv = process.env) {
  return numeroPositivo(env.MOBILE_CHECKIN_PRECISAO_MAX_METROS, PRECISAO_CHECKIN_PADRAO_METROS, 1000);
}

export function validadePacoteDias(env: NodeJS.ProcessEnv = process.env) {
  return numeroPositivo(env.MOBILE_PACOTE_VALIDADE_DIAS, VALIDADE_PACOTE_PADRAO_DIAS, 365);
}
