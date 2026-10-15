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

export type ChamadoAcaoHandlers = {
  abrirExclusao: (acao: 'excluir' | 'restaurar') => void;
  gerarPdf: () => void;
  alternarDocumentos: () => void;
  alternarTarefas: () => void;
};

/** 291: id da ação (desktop ou menu "⋯") → o que a tela faz. Função pura para teste. */
export function executarAcaoChamado(id: ChamadoAcaoId, handlers: ChamadoAcaoHandlers): void {
  const { abrirExclusao, gerarPdf, alternarDocumentos, alternarTarefas } = handlers;
  if (id === 'excluir' || id === 'restaurar') abrirExclusao(id);
  else if (id === 'pdf') gerarPdf();
  else if (id === 'documentos') alternarDocumentos();
  else if (id === 'tarefas') alternarTarefas();
}
