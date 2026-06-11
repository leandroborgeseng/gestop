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

const ALL_CHAMADO_STATUSES: ChamadoStatus[] = [
  'ABERTO',
  'EM_TRIAGEM',
  'EM_ATENDIMENTO',
  'EM_EXECUCAO',
  'IMPEDIDO',
  'CONCLUIDO',
  'CANCELADO',
];

export function selectableChamadoStatuses(from: ChamadoStatus): ChamadoStatus[] {
  return ALL_CHAMADO_STATUSES.filter((status) => status !== from);
}

/** @deprecated Prefer selectableChamadoStatuses — mantido para compatibilidade de imports antigos */
export function nextChamadoStatuses(status: ChamadoStatus) {
  return selectableChamadoStatuses(status);
}

export function canTransitionChamadoStatus(from: ChamadoStatus, to: ChamadoStatus) {
  if (from === to) return false;
  return ALL_CHAMADO_STATUSES.includes(to);
}

export function assertValidChamadoTransition(from: ChamadoStatus, to: ChamadoStatus) {
  if (from === to) return;
  if (!canTransitionChamadoStatus(from, to)) {
    throw new Error(`Transição inválida de ${from} para ${to}`);
  }
}

export function isEvidenciaExecucaoCampo(metadata: unknown) {
  if (!metadata || typeof metadata !== 'object') return false;
  return (metadata as { origem?: string }).origem === 'execucao_campo';
}

export function historicoHasExecucaoCheckin(historico: Array<{ metadata: unknown }>) {
  return historico.some((item) => {
    if (!item.metadata || typeof item.metadata !== 'object') return false;
    return (item.metadata as { tipo?: string }).tipo === 'execucao_checkin';
  });
}

export function parseExecucaoCheckinMetadata(metadata: unknown, createdAt: Date | string) {
  if (!metadata || typeof metadata !== 'object') return null;
  const data = metadata as {
    latitude?: number;
    longitude?: number;
    precisaoMetros?: number;
    distanciaMetros?: number;
    raioMetros?: number;
  };

  if (data.latitude == null || data.longitude == null) return null;

  return {
    latitude: data.latitude,
    longitude: data.longitude,
    precisaoMetros: data.precisaoMetros ?? null,
    distanciaMetros: data.distanciaMetros ?? null,
    raioMetros: data.raioMetros ?? null,
    createdAt: typeof createdAt === 'string' ? createdAt : createdAt.toISOString(),
  };
}

export function nextChamadoStatusFlow(status: ChamadoStatus): ChamadoStatus | null {
  const flow: ChamadoStatus[] = ['ABERTO', 'EM_TRIAGEM', 'EM_ATENDIMENTO', 'EM_EXECUCAO', 'CONCLUIDO'];
  const index = flow.indexOf(status);
  if (index === -1 || status === 'IMPEDIDO') return null;
  if (index >= flow.length - 1) return null;
  return flow[index + 1];
}
