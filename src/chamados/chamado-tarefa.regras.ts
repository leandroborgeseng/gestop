export const TAREFA_STATUS_PENDENTES = ['NOVA', 'VISUALIZADA', 'EM_ANDAMENTO', 'IMPEDIDA'] as const;
export const TAREFA_STATUS_FINAIS = ['CONCLUIDA', 'CANCELADA'] as const;

export function tarefaAtrasada(status: string, prazo: Date | null | undefined, now = new Date()) {
  if (!prazo) return false;
  if (status === 'CONCLUIDA' || status === 'CANCELADA') return false;
  return prazo.getTime() < now.getTime();
}

export function situacaoPrazoTarefa(
  input: { status: string; prazo: Date | null | undefined; concluidaEm: Date | null | undefined },
  now = new Date(),
) {
  if (!input.prazo) return 'Sem prazo';
  if (input.status === 'CANCELADA') return 'Cancelada';
  if (input.status === 'CONCLUIDA') {
    if (input.concluidaEm && input.concluidaEm.getTime() > input.prazo.getTime()) return 'Concluída com atraso';
    return 'Concluída no prazo';
  }
  if (input.prazo.getTime() < now.getTime()) return 'Atrasada';
  return 'No prazo';
}
