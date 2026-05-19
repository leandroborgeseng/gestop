import { OrdemServicoStatus, Severidade } from '@prisma/client';

export function shouldGenerateServiceOrder(input: { naoConformidadeId: string; ordemServicoId?: string | null }) {
  return Boolean(input.naoConformidadeId) && !input.ordemServicoId;
}

export function priorityFromSeverity(severidade: Severidade) {
  if (severidade === Severidade.CRITICA) return 'URGENTE' as const;
  if (severidade === Severidade.ALTA) return 'ALTA' as const;
  if (severidade === Severidade.MEDIA) return 'MEDIA' as const;
  return 'BAIXA' as const;
}

export function buildServiceOrderTitle(itemTitle: string) {
  return `Corrigir não conformidade: ${itemTitle}`;
}

export function buildServiceOrderCode(sequence: number, date = new Date()) {
  return `OS-${date.getFullYear()}-${String(sequence).padStart(6, '0')}`;
}

const allowedTransitions: Record<OrdemServicoStatus, OrdemServicoStatus[]> = {
  ABERTA: ['EM_TRIAGEM', 'ATRIBUIDA', 'CANCELADA'],
  EM_TRIAGEM: ['ATRIBUIDA', 'CANCELADA'],
  ATRIBUIDA: ['EM_EXECUCAO', 'IMPEDIDA', 'CANCELADA'],
  EM_EXECUCAO: ['CONCLUIDA', 'IMPEDIDA'],
  IMPEDIDA: ['ATRIBUIDA', 'EM_EXECUCAO', 'CANCELADA'],
  CONCLUIDA: [],
  CANCELADA: [],
};

export function canTransitionOrderStatus(from: OrdemServicoStatus, to: OrdemServicoStatus) {
  return allowedTransitions[from].includes(to);
}

export function assertValidOrderTransition(from: OrdemServicoStatus, to: OrdemServicoStatus) {
  if (from === to) return;

  if (!canTransitionOrderStatus(from, to)) {
    throw new Error(`Transição inválida de ${from} para ${to}`);
  }
}
