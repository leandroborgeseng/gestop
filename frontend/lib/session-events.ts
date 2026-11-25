import type { AuthUser } from '@/lib/types';

/**
 * 306/S3 — troca de Secretaria ativa (ou perfil) sem recarregar a página.
 * O evento é cancelável: uma tela que se atualiza sozinha chama `preventDefault()`;
 * se nenhuma tratar, o seletor mantém o comportamento antigo (recarregar).
 */
export const SESSAO_ESCOPO_EVENT = 'sigma:sessao-escopo';

export type SessaoEscopoDetail = { user: AuthUser };

/** Dispara o evento; retorna true se alguma tela tratou (preventDefault). */
export function emitirTrocaEscopo(user: AuthUser): boolean {
  if (typeof window === 'undefined') return false;
  const evento = new CustomEvent<SessaoEscopoDetail>(SESSAO_ESCOPO_EVENT, { detail: { user }, cancelable: true });
  return !window.dispatchEvent(evento);
}
