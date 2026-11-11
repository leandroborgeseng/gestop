import { getDefaultAuthenticatedHref, resolvePreferredHref, type NavUser } from '@/lib/navigation';

/**
 * 322 — primeira tela depois do login ou ao abrir `/` (start_url do PWA).
 * A ordem é a do menu, que começa pelo CCO.
 * A função é pura: não troca Secretaria nem perfil ativo.
 *
 * As permissões individuais (Administração > Permissões) somam às do perfil,
 * do mesmo jeito que a sessão em `buildSessionPayload`.
 */
export type CamadasPermissaoTela = {
  /** Chaves do perfil ativo. */
  perfil?: readonly string[];
  /** Concessões de Administração > Permissões. */
  individuais?: readonly string[];
  user?: NavUser;
};

/** União perfil + individuais. Não remove chave do perfil. */
export function mesclarPermissoesDeTela(entrada: CamadasPermissaoTela): string[] {
  return [...new Set([...(entrada.perfil ?? []), ...(entrada.individuais ?? [])])];
}

/** Primeira funcionalidade permitida. Sem nenhuma, `/conta`. */
export function primeiraTelaPermitida(
  permissoesOuCamadas: string[] | CamadasPermissaoTela,
  user?: NavUser,
): string {
  if (Array.isArray(permissoesOuCamadas)) {
    return getDefaultAuthenticatedHref(permissoesOuCamadas, user);
  }
  return getDefaultAuthenticatedHref(
    mesclarPermissoesDeTela(permissoesOuCamadas),
    permissoesOuCamadas.user ?? user,
  );
}

/** Só aceita caminho interno. Descarta a raiz, o login e URL absoluta. */
export function sanitizeReturnTo(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed.startsWith('/') || trimmed.startsWith('//') || trimmed.includes('\\') || trimmed.includes('://')) {
    return null;
  }
  const path = trimmed.split(/[?#]/)[0] || '/';
  if (path === '/' || path === '/login' || path.startsWith('/login/')) return null;
  return trimmed;
}

/** Login sem returnTo (ou com returnTo inválido) cai na tela padrão. Com returnTo, respeita a rota se houver permissão. */
export function hrefDepoisDoLogin(
  permissoes: string[],
  user: NavUser | undefined,
  returnTo: string | null | undefined,
): string {
  const safe = sanitizeReturnTo(returnTo);
  if (!safe) return primeiraTelaPermitida(permissoes, user);
  return resolvePreferredHref(permissoes, safe, user);
}

export type MotivoEntrada = 'raiz' | 'login' | 'rota' | 'foco' | 'visibilidade' | 'refresh-token';

/**
 * A tela padrão só entra na raiz `/` (start_url do PWA) ou no login sem returnTo.
 * F5, rota específica, foco, visibilitychange e renovação de token não redirecionam.
 */
export function deveIrParaTelaPadrao(motivo: MotivoEntrada, pathname: string): boolean {
  if (motivo === 'foco' || motivo === 'visibilidade' || motivo === 'refresh-token' || motivo === 'rota') {
    return false;
  }
  if (motivo === 'login') return true;
  const path = pathname.split(/[?#]/)[0] || '/';
  return path === '/';
}
