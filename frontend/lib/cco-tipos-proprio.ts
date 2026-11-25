import type { TipoPendencia, UnidadeFilters, UnidadeSituacao } from '@/lib/types';

/** 312: opção do filtro Tipo de próprio (rótulo = Nome do catálogo). */
export type TipoProprioDisponivel = { codigo: string; nome: string };

export const TEXTO_SEM_TIPOS_PROPRIO = 'Nenhum tipo disponível';

/**
 * Filtros enviados para calcular os tipos disponíveis: os mesmos da lista de próprios,
 * exceto o próprio filtro de tipo (B2).
 */
export function filtrosParaTiposProprio(
  filters: UnidadeFilters,
  opts: { kpiFilter: 'none' | 'pendencias'; defaultTiposPendencia: TipoPendencia[] },
): UnidadeFilters {
  return {
    ...filters,
    tipo: undefined,
    tipos: undefined,
    responsavel: undefined,
    responsavelEmail: undefined,
    tiposPendencia: filters.tiposPendencia?.length ? filters.tiposPendencia : [...opts.defaultTiposPendencia],
    ...(opts.kpiFilter === 'pendencias' ? { situacao: 'COM_PENDENCIAS' as UnidadeSituacao } : {}),
  };
}

/** Chave estável para saber se a resposta corresponde aos filtros atuais. */
export function chaveFiltrosTiposProprio(filters: UnidadeFilters): string {
  const entries = Object.entries(filters)
    .filter(([, v]) => v !== undefined && v !== '' && !(Array.isArray(v) && v.length === 0))
    .map(([k, v]) => [k, Array.isArray(v) ? [...v].map(String).sort() : v] as const)
    .sort(([a], [b]) => a.localeCompare(b));
  return JSON.stringify(entries);
}

/**
 * B4: devolve os tipos selecionados que continuam válidos, ou `null` se nada mudou.
 * Só o filtro de tipo é alterado; os demais filtros ficam como estão.
 */
export function podarTiposInvalidos(selecionados: string[], disponiveis: TipoProprioDisponivel[]): string[] | null {
  if (selecionados.length === 0) return null;
  const validos = new Set(disponiveis.map((t) => t.codigo));
  const mantidos = selecionados.filter((codigo) => validos.has(codigo));
  return mantidos.length === selecionados.length ? null : mantidos;
}
