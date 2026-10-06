/** Rotina ativa. IMPEDIDA permanece no enum só para registros antigos. */
export const TAREFA_STATUS_PENDENTES = ['NOVA', 'VISUALIZADA', 'EM_ANDAMENTO'] as const;
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

export const ROTULO_SEM_RESPONSAVEL = 'Sem responsável';
export const ROTULO_SEM_EQUIPE = 'Sem equipe';

export function rotuloResponsavelTarefa(nome?: string | null) {
  return nome?.trim() || ROTULO_SEM_RESPONSAVEL;
}

export function rotuloEquipeTarefa(nome?: string | null) {
  return nome?.trim() || ROTULO_SEM_EQUIPE;
}

export type EventoAtribuicaoTarefa = {
  acao: 'responsavel' | 'equipe';
  detalhe: string;
  valorAnterior: string;
  valorNovo: string;
};

/** Cada troca (responsável ou equipe) vira um evento próprio. As duas juntas geram dois. */
export function eventosAtribuicaoTarefa(input: {
  mudouResponsavel: boolean;
  mudouEquipe: boolean;
  responsavelAnterior: string;
  responsavelNovo: string;
  equipeAnterior: string;
  equipeNova: string;
}): EventoAtribuicaoTarefa[] {
  const eventos: EventoAtribuicaoTarefa[] = [];
  if (input.mudouResponsavel) {
    eventos.push({
      acao: 'responsavel',
      valorAnterior: input.responsavelAnterior,
      valorNovo: input.responsavelNovo,
      detalhe: `${input.responsavelAnterior} → ${input.responsavelNovo}`,
    });
  }
  if (input.mudouEquipe) {
    eventos.push({
      acao: 'equipe',
      valorAnterior: input.equipeAnterior,
      valorNovo: input.equipeNova,
      detalhe: `${input.equipeAnterior} → ${input.equipeNova}`,
    });
  }
  return eventos;
}
