import type { TipoPendencia, UnidadeFilters, UnidadeSituacao } from '@/lib/types';

/** 319: opção de categoria do "Mapa: Notas" (`total` = próprios com nota nessa categoria). */
export type CategoriaNotaDisponivel = { id: string; nome: string; total: number };

export const ROTULO_NOTA_GERAL = 'Nota geral (Likert)';

/** Os mesmos filtros efetivos da lista de próprios (página da CCO). */
export function filtrosParaCategoriasNota(
  filters: UnidadeFilters,
  opts: { kpiFilter: 'none' | 'pendencias'; defaultTiposPendencia: TipoPendencia[] },
): UnidadeFilters {
  return {
    ...filters,
    responsavel: undefined,
    responsavelEmail: undefined,
    tiposPendencia: filters.tiposPendencia?.length ? filters.tiposPendencia : [...opts.defaultTiposPendencia],
    ...(opts.kpiFilter === 'pendencias' ? { situacao: 'COM_PENDENCIAS' as UnidadeSituacao } : {}),
  };
}

/** Volta para a Nota geral ('') se a categoria selecionada não estiver mais entre as disponíveis. */
export function categoriaAindaValida(selecionada: string, disponiveis: CategoriaNotaDisponivel[]): boolean {
  return !selecionada || disponiveis.some((c) => c.id === selecionada);
}
