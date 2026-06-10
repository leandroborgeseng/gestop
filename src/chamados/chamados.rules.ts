import { ChamadoStatus, ChamadoPrioridade, Severidade } from '@prisma/client';

export function buildChamadoCode(sequence: number) {
  return `CH-${new Date().getFullYear()}-${String(sequence).padStart(6, '0')}`;
}

export function buildChamadoTitleFromNc(itemTitle: string) {
  return `Corrigir não conformidade: ${itemTitle}`;
}

export function shouldGenerateChamadoFromNc(input: { naoConformidadeId: string; chamadoId?: string | null }) {
  return Boolean(input.naoConformidadeId) && !input.chamadoId;
}

export function priorityFromSeverity(severidade: Severidade) {
  if (severidade === Severidade.CRITICA) return ChamadoPrioridade.URGENTE;
  if (severidade === Severidade.ALTA) return ChamadoPrioridade.ALTA;
  if (severidade === Severidade.MEDIA) return ChamadoPrioridade.MEDIA;
  return ChamadoPrioridade.BAIXA;
}

export function buildDefaultDeadlineFromSeverity(severidade: string) {
  const date = new Date();
  const days = severidade === 'CRITICA' ? 1 : severidade === 'ALTA' ? 2 : severidade === 'MEDIA' ? 5 : 10;
  date.setDate(date.getDate() + days);
  return date;
}

const allowedTransitions: Record<ChamadoStatus, ChamadoStatus[]> = {
  ABERTO: ['EM_TRIAGEM', 'EM_ATENDIMENTO', 'CANCELADO'],
  EM_TRIAGEM: ['EM_ATENDIMENTO', 'CANCELADO'],
  EM_ATENDIMENTO: ['IMPEDIDO', 'CONCLUIDO', 'CANCELADO'],
  IMPEDIDO: ['EM_ATENDIMENTO', 'CANCELADO'],
  CONCLUIDO: [],
  CANCELADO: [],
};

export function canTransitionChamadoStatus(from: ChamadoStatus, to: ChamadoStatus) {
  return allowedTransitions[from].includes(to);
}

export function assertValidChamadoTransition(from: ChamadoStatus, to: ChamadoStatus) {
  if (from === to) return;
  if (!canTransitionChamadoStatus(from, to)) {
    throw new Error(`Transição inválida de ${from} para ${to}`);
  }
}

export function nextChamadoStatusFlow(status: ChamadoStatus): ChamadoStatus | null {
  const flow: ChamadoStatus[] = ['ABERTO', 'EM_TRIAGEM', 'EM_ATENDIMENTO', 'CONCLUIDO'];
  const index = flow.indexOf(status);
  if (index === -1 || status === 'IMPEDIDO') return null;
  if (index >= flow.length - 1) return null;
  return flow[index + 1];
}
