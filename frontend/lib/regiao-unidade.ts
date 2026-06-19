export type RegiaoUnidade = 'NORTE' | 'SUL' | 'LESTE' | 'OESTE' | 'CENTRO';

export const REGIAO_UNIDADE_LABELS: Record<RegiaoUnidade, string> = {
  NORTE: 'Norte',
  SUL: 'Sul',
  LESTE: 'Leste',
  OESTE: 'Oeste',
  CENTRO: 'Centro',
};

export function formatRegiaoUnidade(regiao?: RegiaoUnidade | null) {
  if (!regiao) return '—';
  return REGIAO_UNIDADE_LABELS[regiao] ?? regiao;
}
