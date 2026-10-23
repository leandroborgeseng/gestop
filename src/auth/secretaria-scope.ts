import { BadRequestException, ForbiddenException } from '@nestjs/common';
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

/**
 * Acesso ao chamado por:
 * - Secretaria responsável pela execução (`chamado.secretariaId`)
 * - Secretaria do próprio (`unidade.secretariaId`)
 * - Secretaria da equipe atualmente atribuída (`equipe.secretariaId`) — encaminhamento operacional
 */
export function resolveChamadoSecretariaFilter(user: JwtPayload): Prisma.ChamadoWhereInput {
  const ids = resolveSecretariaScopeIds(user);
  if (!ids) return {};
  if (ids.length === 0) return { id: { in: [] } };
  if (ids.length === 1) {
    const secretariaId = ids[0];
    return {
      OR: [
        { secretariaId },
        { unidade: { secretariaId } },
        { equipe: { secretariaId } },
      ],
    };
  }
  return {
    OR: [
      { secretariaId: { in: ids } },
      { unidade: { secretariaId: { in: ids } } },
      { equipe: { secretariaId: { in: ids } } },
    ],
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

/** Visualização: execução, próprio OU secretaria da equipe atribuída. */
export function assertChamadoSecretariaAccess(
  user: JwtPayload,
  chamado: {
    secretariaId: string;
    unidade?: {
      secretariaId?: string | null;
      secretaria?: { id: string } | null;
    } | null;
    equipe?: {
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
  const equipeSec = chamado.equipe?.secretariaId ?? chamado.equipe?.secretaria?.id;
  if (equipeSec && ids.includes(equipeSec)) return;

  throw new ForbiddenException('Chamado fora da secretaria autorizada.');
}

/**
 * Tratativa operacional: secretaria de execução OU secretaria da equipe atribuída
 * (encaminhamento operacional sem alterar a secretaria responsável original).
 */
export function assertChamadoExecucaoAccess(
  user: JwtPayload,
  chamado: {
    secretariaId: string;
    equipe?: {
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
  const equipeSec = chamado.equipe?.secretariaId ?? chamado.equipe?.secretaria?.id;
  if (equipeSec && ids.includes(equipeSec)) return;

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

/**
 * 306 — função única de escopo para leituras agregadas (Dashboard, pendências, sync, auditoria, alertas).
 * Escopo efetivo = escopo da sessão (Secretaria ativa / vínculos / global) refinado pelo filtro superior.
 * - `undefined` = visão global real (administrador em "Todas"), sem filtro.
 * - `[]` = sem Secretaria autorizada (nada é retornado).
 * - Filtro fora do escopo (URL/API forçada) → 403.
 */
export function resolveSecretariaFiltroEscopo(
  user: JwtPayload,
  filtroSecretariaId?: string | readonly string[] | null,
): string[] | undefined {
  const scope = resolveSecretariaScopeIds(user);
  const filtro = normalizarSecretariaIds(filtroSecretariaId);
  if (!filtro.length) return scope;
  if (scope && filtro.some((id) => !scope.includes(id))) {
    throw new ForbiddenException('Secretaria fora do escopo da sessão.');
  }
  return filtro;
}

/**
 * R3 (306) — forma única do filtro `secretariaId` em query: sempre array de ids (trim, sem vazios, sem repetidos).
 * Aceita `secretariaId=A`, `secretariaId=A&secretariaId=B` e `secretariaId[]=A`. Qualquer outro tipo → 400.
 */
export function normalizarSecretariaIds(raw: unknown): string[] {
  if (raw === undefined || raw === null) return [];
  const lista = Array.isArray(raw) ? raw : [raw];
  if (lista.some((v) => typeof v !== 'string')) {
    throw new BadRequestException('secretariaId deve ser um id ou uma lista de ids.');
  }
  return [...new Set((lista as string[]).map((v) => v.trim()).filter(Boolean))];
}

/** Lê `secretariaId` e `secretariaId[]` de um objeto de query (Express 5, parser simples). */
export function secretariaIdsDaQuery(query: Record<string, unknown> | undefined): string[] {
  // Ciclo 2 (F2): só `secretariaId` e `secretariaId[]`; `secretariaId[x]`, `secretariaId[0]` etc. → 400.
  const invalida = Object.keys(query ?? {}).find((k) => k.startsWith('secretariaId[') && k !== 'secretariaId[]');
  if (invalida) throw new BadRequestException('secretariaId deve ser um id ou uma lista de ids.');
  return normalizarSecretariaIds([
    ...normalizarSecretariaIds(query?.secretariaId),
    ...normalizarSecretariaIds(query?.['secretariaId[]']),
  ]);
}

/** `{ secretariaId: { in: ids } }` ou `{}` (global). `[]` vira `{ in: [] }` (zero linhas). */
export function whereSecretariaIdIn(ids: string[] | undefined): { secretariaId?: { in: string[] } } {
  return ids ? { secretariaId: { in: ids } } : {};
}
