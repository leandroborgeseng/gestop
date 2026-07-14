import { ForbiddenException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { JwtPayload } from './jwt';

/** Administrador do sistema — visão global. */
export function isGlobalOperator(user: JwtPayload) {
  return user.permissoes.includes('usuarios.gerenciar') || Boolean(user.acessoTodasSecretarias);
}

/** Operador com escopo em uma secretaria específica. */
export function isSecretariaScoped(user: JwtPayload) {
  if (isGlobalOperator(user) && !user.secretariaId?.trim()) return false;
  return Boolean(user.secretariaId?.trim());
}

/**
 * Retorna a secretaria ativa da sessão (escopo).
 * `undefined` = sem filtro (todas as secretarias autorizadas / visão global).
 */
export function resolveSecretariaScopeId(user: JwtPayload): string | undefined {
  const active = user.secretariaId?.trim();
  if (!active) return undefined;
  return active;
}

/**
 * IDs de secretarias no escopo da sessão.
 * `undefined` = visão global (sem filtro).
 * `[]` = sem secretaria autorizada (não enxerga dados de outras secretarias).
 */
export function resolveSecretariaScopeIds(user: JwtPayload): string[] | undefined {
  if (user.acessoTodasSecretarias || user.permissoes.includes('usuarios.gerenciar')) {
    if (!user.secretariaId?.trim()) return undefined; // global real
  }
  const active = resolveSecretariaScopeId(user);
  if (active) return [active];
  const links = user.secretariasIds?.filter(Boolean) ?? [];
  if (links.length > 0) return links;
  // Sem secretaria ativa/vínculos e sem modo global: bloqueia acesso cruzado
  return [];
}

export function resolveChamadoSecretariaFilter(user: JwtPayload): Prisma.ChamadoWhereInput {
  const ids = resolveSecretariaScopeIds(user);
  if (!ids) return {};
  if (ids.length === 0) return { id: { in: [] } };
  if (ids.length === 1) {
    const secretariaId = ids[0];
    return {
      OR: [{ secretariaId }, { unidade: { secretariaId } }],
    };
  }
  return {
    OR: [{ secretariaId: { in: ids } }, { unidade: { secretariaId: { in: ids } } }],
  };
}

export function resolveEquipeSecretariaFilter(user: JwtPayload): Prisma.EquipeWhereInput {
  const ids = resolveSecretariaScopeIds(user);
  if (!ids) return {};
  if (ids.length === 0) return { id: { in: [] } };
  return ids.length === 1 ? { secretariaId: ids[0] } : { secretariaId: { in: ids } };
}

export function resolveUnidadeSecretariaFilter(user: JwtPayload): Prisma.UnidadePublicaWhereInput {
  const ids = resolveSecretariaScopeIds(user);
  if (!ids) return {};
  if (ids.length === 0) return { id: { in: [] } };
  return ids.length === 1 ? { secretariaId: ids[0] } : { secretariaId: { in: ids } };
}

/** Visualização: execução OU próprio da secretaria no escopo. */
export function assertChamadoSecretariaAccess(
  user: JwtPayload,
  chamado: {
    secretariaId: string;
    unidade?: {
      secretariaId?: string | null;
      secretaria?: { id: string } | null;
    } | null;
  },
) {
  if (user.permissoes.includes('usuarios.gerenciar') || user.acessoTodasSecretarias) {
    if (!user.secretariaId?.trim()) return;
  }

  const ids = resolveSecretariaScopeIds(user);
  if (!ids) return;

  if (ids.includes(chamado.secretariaId)) return;
  const unidadeSec = chamado.unidade?.secretariaId ?? chamado.unidade?.secretaria?.id;
  if (unidadeSec && ids.includes(unidadeSec)) return;

  throw new ForbiddenException('Chamado fora da secretaria autorizada.');
}

/** Tratativa operacional: somente secretaria responsável pela execução. */
export function assertChamadoExecucaoAccess(user: JwtPayload, chamado: { secretariaId: string }) {
  if (user.permissoes.includes('usuarios.gerenciar') || user.acessoTodasSecretarias) {
    if (!user.secretariaId?.trim()) return;
  }

  const ids = resolveSecretariaScopeIds(user);
  if (!ids) return;
  if (ids.includes(chamado.secretariaId)) return;

  throw new ForbiddenException('Sem permissão de tratativa: secretaria de execução diferente da ativa.');
}

/** Garante que a secretaria alvo está no escopo ativo (abertura / cadastro). */
export function assertSecretariaNoEscopo(user: JwtPayload, secretariaId: string) {
  const ids = resolveSecretariaScopeIds(user);
  if (!ids) return;
  if (ids.includes(secretariaId)) return;
  throw new ForbiddenException('Nao e permitido atuar fora da secretaria autorizada na sessao.');
}

/** Filtro de secretaria em entidades com `secretariaId` direto (ex.: fiscalização). */
export function resolveDirectSecretariaFilter(user: JwtPayload): { secretariaId?: string | { in: string[] } } | { id: { in: [] } } {
  const ids = resolveSecretariaScopeIds(user);
  if (!ids) return {};
  if (ids.length === 0) return { id: { in: [] } };
  return ids.length === 1 ? { secretariaId: ids[0] } : { secretariaId: { in: ids } };
}
