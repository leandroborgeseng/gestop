import type { ChamadosMapaFilters, TipoPendencia, UnidadeFilters, UnidadeSituacao } from '@/lib/types';
import { chaveFiltrosTiposProprio } from '@/lib/cco-tipos-proprio';

/** 316: opção do filtro Tipo de chamado da CCO (vem do backend, consulta agregada). */
export type TipoChamadoDisponivel = { id: string; nome: string; total: number };

export const TEXTO_SEM_TIPOS_CHAMADO = 'Nenhum tipo de chamado disponível';

/** Aba Próprios: os mesmos filtros da lista de próprios, exceto o próprio Tipo de chamado. */
export function filtrosParaTiposChamadoProprios(
  filters: UnidadeFilters,
  opts: { kpiFilter: 'none' | 'pendencias'; defaultTiposPendencia: TipoPendencia[] },
): UnidadeFilters {
  return {
    ...filters,
    tiposChamadoId: undefined,
    responsavel: undefined,
    responsavelEmail: undefined,
    tiposPendencia: filters.tiposPendencia?.length ? filters.tiposPendencia : [...opts.defaultTiposPendencia],
    ...(opts.kpiFilter === 'pendencias' ? { situacao: 'COM_PENDENCIAS' as UnidadeSituacao } : {}),
  };
}

/** Aba Chamados: os mesmos filtros do mapa de chamados (rápidos e datas inclusive), exceto o Tipo de chamado. */
export function filtrosParaTiposChamadoMapa(filters: ChamadosMapaFilters): ChamadosMapaFilters {
  return { ...filters, tipoChamadoId: undefined };
}

export function chaveFiltrosTiposChamado(tab: string, filters: object): string {
  return `${tab}:${chaveFiltrosTiposProprio(filters as UnidadeFilters)}`;
}

/** Limpa só o Tipo de chamado inválido: devolve os selecionados que continuam válidos, ou `null` se nada mudou. */
export function podarTiposChamadoInvalidos(selecionados: string[], disponiveis: TipoChamadoDisponivel[]): string[] | null {
  if (selecionados.length === 0) return null;
  const validos = new Set(disponiveis.map((t) => t.id));
  const mantidos = selecionados.filter((id) => validos.has(id));
  return mantidos.length === selecionados.length ? null : mantidos;
}
