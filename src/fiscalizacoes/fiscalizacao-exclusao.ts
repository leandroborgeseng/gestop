/**
 * 305 — exclusão lógica de vistorias realizadas.
 * Nenhum registro é apagado: a vistoria vai para EXCLUIDA com `excluidoEm`, e toda leitura operacional
 * (lista, indicadores, notas, CCO, Dashboard, relatórios) a ignora por padrão, pelo filtro central abaixo.
 * Quem precisa enxergar a excluída (Mostrar excluídas, baixa da programação/E6) cita `excluidoEm` no where.
 */
import { Prisma } from '@prisma/client';
import { JwtPayload } from '../auth/jwt';
import { hasAllPermissions } from '../auth/permissions';
import { permissionMatrixKey } from '../domain/permissions-catalog';
import { whereMencionaExclusao } from '../chamados/chamado-visibilidade';

/** E1: a ação Excluir que já existe na tela Vistorias realizadas. */
export const VISTORIA_EXCLUIR = permissionMatrixKey('vistorias', '_tela', 'excluir');
/** E4: subfunção nova "Visualizar excluídas". */
export const VISTORIA_EXCLUIDAS_VISUALIZAR = permissionMatrixKey('vistorias', 'excluidas_visualizar', 'visualizar');

export const VISTORIA_MOTIVO_MIN = 20;
export const VISTORIA_MOTIVO_MAX = 1000;

export const FISCALIZACAO_ATIVA_WHERE: Prisma.FiscalizacaoWhereInput = { excluidoEm: null };
export const FISCALIZACAO_EXCLUIDA_WHERE: Prisma.FiscalizacaoWhereInput = { excluidoEm: { not: null } };
/** Ativas e excluídas. A menção a `excluidoEm` desliga o filtro automático. */
export const FISCALIZACAO_COM_EXCLUIDAS_WHERE: Prisma.FiscalizacaoWhereInput = {
  OR: [{ excluidoEm: null }, { excluidoEm: { not: null } }],
};

/** 305/E6: vistoria que realizou a programação — concluída, ou excluída que estava concluída. Cita `excluidoEm`. */
export const VISTORIA_REALIZADA_OU_EXCLUIDA_WHERE: Prisma.FiscalizacaoWhereInput = {
  OR: [
    { status: 'CONCLUIDA', excluidoEm: null },
    { status: 'EXCLUIDA', excluidoEm: { not: null }, statusAntesExclusao: 'CONCLUIDA' },
  ],
};

/** Para relações aninhadas (`_count`, `include`) e para NaoConformidade, onde o filtro automático não alcança. */
export const NC_DE_VISTORIA_ATIVA_WHERE: Prisma.NaoConformidadeWhereInput = { fiscalizacao: { excluidoEm: null } };

export function podeExcluirVistoria(user?: Pick<JwtPayload, 'permissoes' | 'perfis'> | null) {
  return hasAllPermissions(user ?? undefined, [VISTORIA_EXCLUIR]);
}

export function podeVisualizarVistoriasExcluidas(user?: Pick<JwtPayload, 'permissoes' | 'perfis'> | null) {
  return hasAllPermissions(user ?? undefined, [VISTORIA_EXCLUIDAS_VISUALIZAR]);
}

/** Motivo obrigatório (E1): devolve o texto limpo ou `null` quando inválido. */
export function normalizarMotivoExclusao(motivo: unknown): string | null {
  if (typeof motivo !== 'string') return null;
  const limpo = motivo.replace(/\s+/g, ' ').trim();
  if (limpo.length < VISTORIA_MOTIVO_MIN || limpo.length > VISTORIA_MOTIVO_MAX) return null;
  return limpo;
}

type FiscalizacaoQueryArgs = { where?: Prisma.FiscalizacaoWhereInput };

export function applyFiscalizacaoOperacionalFilter<T extends FiscalizacaoQueryArgs | undefined>(args: T): T {
  const source = (args ?? {}) as FiscalizacaoQueryArgs;
  if (whereMencionaExclusao(source.where)) return (args ?? source) as T;
  const where = source.where;
  const filtrado =
    !where || Object.keys(where).length === 0 ? FISCALIZACAO_ATIVA_WHERE : { AND: [where, FISCALIZACAO_ATIVA_WHERE] };
  return { ...source, where: filtrado } as T;
}
