import type { JwtPayload } from '../jwt';
import { resolveSecretariaScopeIds } from '../secretaria-scope';
import { resolveEffectiveMatrixKeys } from '../../domain/permissions-matrix';
import type { EntradaMatriz, RegraPermissao } from './permissoes-matriz';

/**
 * Permissões efetivas da sessão, já calculadas pelo AuthService a partir do perfil ATIVO
 * (perfis inativos não contam) + permissões diretas, expandidas para a matriz fina
 * (chaves legadas → matriz, igual à tela de Permissões).
 */
export function chavesEfetivasDaSessao(user: Pick<JwtPayload, 'permissoes'>): Set<string> {
  return resolveEffectiveMatrixKeys(user.permissoes ?? []);
}

/** Exceção explícita: perfil ativo com flag `administradorSistema` (não depende do nome do perfil). */
export function ehAdministradorSistema(user: Pick<JwtPayload, 'administradorSistema'> | undefined | null) {
  return user?.administradorSistema === true;
}

export type ResultadoAvaliacao = { permitido: true } | { permitido: false; motivo: 'sem-entrada' | 'sem-sessao' | 'sem-permissao' | 'fora-do-escopo' };

export function sessaoTemEscopoSecretaria(user: JwtPayload) {
  const ids = resolveSecretariaScopeIds(user);
  return ids === undefined || ids.length > 0;
}

export function avaliarRegraPermissao(regra: RegraPermissao, user: JwtPayload | undefined): ResultadoAvaliacao {
  if (!user) return { permitido: false, motivo: 'sem-sessao' };
  if (ehAdministradorSistema(user)) return { permitido: true };
  const efetivas = chavesEfetivasDaSessao(user);
  if (!regra.chaves.some((chave) => efetivas.has(chave))) return { permitido: false, motivo: 'sem-permissao' };
  if (regra.escopo === 'secretaria-ativa' && !sessaoTemEscopoSecretaria(user)) {
    return { permitido: false, motivo: 'fora-do-escopo' };
  }
  return { permitido: true };
}

/** Avaliação pura de uma entrada (sem I/O). Entradas `leitura-legada` são avaliadas pelo guard. */
export function avaliarEntrada(entrada: EntradaMatriz | undefined, user: JwtPayload | undefined): ResultadoAvaliacao {
  if (!entrada) return { permitido: false, motivo: 'sem-entrada' };
  switch (entrada.tipo) {
    case 'publico':
      return { permitido: true };
    case 'sessao':
    case 'dono-registro':
    case 'leitura-legada':
      return user ? { permitido: true } : { permitido: false, motivo: 'sem-sessao' };
    case 'permissao':
      return avaliarRegraPermissao(entrada, user);
  }
}
