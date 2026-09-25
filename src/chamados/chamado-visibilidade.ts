import { Prisma, PrismaClient } from '@prisma/client';
import { JwtPayload } from '../auth/jwt';
import { hasAllPermissions } from '../auth/permissions';
import { permissionMatrixKey } from '../domain/permissions-catalog';

export const CHAMADO_EXCLUIDOS_VISUALIZAR = permissionMatrixKey('chamados', 'excluidos_visualizar', 'visualizar');
export const CHAMADO_EXCLUIR_LOGICAMENTE = permissionMatrixKey('chamados', 'excluir_logicamente', 'excluir');
export const CHAMADO_RESTAURAR_EXCLUIDO = permissionMatrixKey('chamados', 'restaurar_excluido', 'alterar');

export const CHAMADO_ATIVO_WHERE: Prisma.ChamadoWhereInput = { excluidoEm: null };

/** Inclui ativos e excluídos. A presença de `excluidoEm` impede o filtro automático. */
export const CHAMADO_INCLUIR_EXCLUIDOS_WHERE: Prisma.ChamadoWhereInput = {
  OR: [{ excluidoEm: null }, { excluidoEm: { not: null } }],
};

export function whereMencionaExclusao(where: unknown): boolean {
  if (!where || typeof where !== 'object') return false;
  if (Array.isArray(where)) return where.some((item) => whereMencionaExclusao(item));
  const record = where as Record<string, unknown>;
  if ('excluidoEm' in record) return true;
  return whereMencionaExclusao(record.AND) || whereMencionaExclusao(record.OR) || whereMencionaExclusao(record.NOT);
}

export function andChamadoAtivo(where?: Prisma.ChamadoWhereInput): Prisma.ChamadoWhereInput {
  if (whereMencionaExclusao(where)) return where ?? CHAMADO_ATIVO_WHERE;
  if (!where || Object.keys(where).length === 0) return CHAMADO_ATIVO_WHERE;
  return { AND: [where, CHAMADO_ATIVO_WHERE] };
}

export function andChamadoComExcluidos(where?: Prisma.ChamadoWhereInput): Prisma.ChamadoWhereInput {
  if (!where || Object.keys(where).length === 0) return CHAMADO_INCLUIR_EXCLUIDOS_WHERE;
  return { AND: [where, CHAMADO_INCLUIR_EXCLUIDOS_WHERE] };
}

export function podeVisualizarChamadosExcluidos(user?: Pick<JwtPayload, 'permissoes' | 'perfis'> | null) {
  return hasAllPermissions(user ?? undefined, [CHAMADO_EXCLUIDOS_VISUALIZAR]);
}

export function podeExcluirChamadoLogicamente(user?: Pick<JwtPayload, 'permissoes' | 'perfis'> | null) {
  return hasAllPermissions(user ?? undefined, [CHAMADO_EXCLUIR_LOGICAMENTE]);
}

export function podeRestaurarChamadoExcluido(user?: Pick<JwtPayload, 'permissoes' | 'perfis'> | null) {
  return hasAllPermissions(user ?? undefined, [CHAMADO_RESTAURAR_EXCLUIDO]);
}

type ChamadoQueryArgs = {
  where?: Prisma.ChamadoWhereInput;
};

export function applyChamadoOperacionalFilter<T extends ChamadoQueryArgs | undefined>(args: T): T {
  const source = (args ?? {}) as ChamadoQueryArgs;
  if (whereMencionaExclusao(source.where)) return (args ?? source) as T;
  return { ...source, where: andChamadoAtivo(source.where) } as T;
}

const CHAMADO_LIST_OPS = new Set(['findMany', 'findFirst', 'count', 'groupBy', 'aggregate']);

/** Toda leitura operacional de Chamado ignora excluídos, salvo where que já cite `excluidoEm`. */
export function withChamadoOperacionalFilter(client: PrismaClient) {
  return client.$extends({
    query: {
      chamado: {
        async $allOperations({ operation, args, query }) {
          if (!CHAMADO_LIST_OPS.has(operation)) return query(args);
          const filtered = applyChamadoOperacionalFilter(args as ChamadoQueryArgs);
          return query(filtered as typeof args);
        },
      },
    },
  });
}
