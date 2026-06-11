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

/** Status considerados "abertos" em KPIs operacionais (CCO, dashboard, pendências). */
export const CHAMADO_OPEN_STATUSES: ChamadoStatus[] = [
  'ABERTO',
  'EM_TRIAGEM',
  'EM_ATENDIMENTO',
  'EM_EXECUCAO',
  'IMPEDIDO',
];

const ALLOWED_CHAMADO_TRANSITIONS: Record<ChamadoStatus, ChamadoStatus[]> = {
  ABERTO: ['EM_TRIAGEM', 'EM_ATENDIMENTO', 'CANCELADO'],
  EM_TRIAGEM: ['ABERTO', 'EM_ATENDIMENTO', 'EM_EXECUCAO', 'CANCELADO'],
  EM_ATENDIMENTO: ['EM_TRIAGEM', 'EM_EXECUCAO', 'IMPEDIDO', 'CONCLUIDO', 'CANCELADO'],
  EM_EXECUCAO: ['EM_ATENDIMENTO', 'IMPEDIDO', 'CONCLUIDO', 'CANCELADO'],
  IMPEDIDO: ['EM_TRIAGEM', 'EM_ATENDIMENTO', 'EM_EXECUCAO', 'CANCELADO'],
  CONCLUIDO: ['EM_TRIAGEM', 'EM_ATENDIMENTO'],
  CANCELADO: ['ABERTO', 'EM_TRIAGEM'],
};

const ALL_CHAMADO_STATUSES: ChamadoStatus[] = [
  ...CHAMADO_OPEN_STATUSES,
  'CONCLUIDO',
  'CANCELADO',
];

export function selectableChamadoStatuses(from: ChamadoStatus): ChamadoStatus[] {
  return ALLOWED_CHAMADO_TRANSITIONS[from] ?? [];
}

/** @deprecated Prefer selectableChamadoStatuses — mantido para compatibilidade de imports antigos */
export function nextChamadoStatuses(status: ChamadoStatus) {
  return selectableChamadoStatuses(status);
}

export function canTransitionChamadoStatus(from: ChamadoStatus, to: ChamadoStatus) {
  if (from === to) return false;
  return ALLOWED_CHAMADO_TRANSITIONS[from]?.includes(to) ?? false;
}

export function assertValidChamadoTransition(from: ChamadoStatus, to: ChamadoStatus) {
  if (from === to) return;
  if (!canTransitionChamadoStatus(from, to)) {
    throw new Error(`Transição inválida de ${from} para ${to}`);
  }
}

export function canUsuarioExecutarChamado(
  permissoes: string[],
  usuarioId: string,
  chamado: { equipeId: string | null },
  membrosEquipeIds: string[],
) {
  if (permissoes.includes('chamados.gerenciar')) return true;
  if (!permissoes.includes('chamados.executar')) return false;
  if (!chamado.equipeId) return false;
  return membrosEquipeIds.includes(usuarioId);
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
