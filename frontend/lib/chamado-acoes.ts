/**
 * 291: ações do cabeçalho do chamado. A mesma lista alimenta a linha fixa do celular (menu "⋯"),
 * para que nenhuma ação suma no mobile.
 */
export type ChamadoAcaoId = 'excluir' | 'restaurar' | 'pdf' | 'documentos' | 'tarefas';

export type ChamadoAcao = {
  id: ChamadoAcaoId;
  label: string;
  disabled: boolean;
  danger?: boolean;
  badge?: number;
};

export function buildChamadoAcoes(input: {
  podeExcluir: boolean;
  podeRestaurar: boolean;
  excluido: boolean;
  busy: boolean;
  exclusaoBusy: boolean;
  pdfBusy: boolean;
  tarefasPendentes: number;
}): ChamadoAcao[] {
  const acoes: ChamadoAcao[] = [];
  if (input.podeExcluir && !input.excluido) {
    acoes.push({ id: 'excluir', label: 'Excluir chamado', disabled: input.busy || input.exclusaoBusy, danger: true });
  }
  if (input.podeRestaurar && input.excluido) {
    acoes.push({ id: 'restaurar', label: 'Restaurar chamado', disabled: input.busy || input.exclusaoBusy });
  }
  acoes.push({ id: 'pdf', label: input.pdfBusy ? 'Gerando…' : 'PDF', disabled: input.pdfBusy || input.busy });
  acoes.push({ id: 'documentos', label: 'Documentos relacionados', disabled: input.busy });
  acoes.push({
    id: 'tarefas',
    label: 'Tarefas',
    disabled: input.busy,
    badge: input.tarefasPendentes > 0 ? input.tarefasPendentes : undefined,
  });
  return acoes;
}
