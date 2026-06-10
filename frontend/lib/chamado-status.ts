export const CHAMADO_STATUS_META: Record<
  string,
  { label: string; badge: 'info' | 'warning' | 'brand' | 'success' | 'muted' | 'danger' }
> = {
  ABERTO: { label: 'Aberto', badge: 'info' },
  EM_TRIAGEM: { label: 'Em triagem', badge: 'warning' },
  EM_ATENDIMENTO: { label: 'Em atendimento', badge: 'brand' },
  IMPEDIDO: { label: 'Impedido', badge: 'danger' },
  CONCLUIDO: { label: 'Concluído', badge: 'success' },
  CANCELADO: { label: 'Cancelado', badge: 'muted' },
};

export function chamadoStatusLabel(status: string) {
  return CHAMADO_STATUS_META[status]?.label ?? status;
}

export function selectableChamadoStatuses(status: string) {
  return Object.keys(CHAMADO_STATUS_META).filter((item) => item !== status);
}

/** @deprecated Prefer selectableChamadoStatuses */
export function nextChamadoStatuses(status: string) {
  return selectableChamadoStatuses(status);
}

export function nextChamadoStatusFlow(status: string) {
  const flow = ['ABERTO', 'EM_TRIAGEM', 'EM_ATENDIMENTO', 'CONCLUIDO'];
  const index = flow.indexOf(status);
  if (index === -1 || status === 'IMPEDIDO') return null;
  if (index >= flow.length - 1) return null;
  return flow[index + 1];
}

export function prioridadeVariant(prioridade: string): 'danger' | 'warning' | 'neutral' {
  const value = prioridade.toUpperCase();
  if (value.includes('ALTA') || value.includes('URG')) return 'danger';
  if (value.includes('MED')) return 'warning';
  return 'neutral';
}

export function prazoInfo(prazoEm: string | null | undefined, status: string) {
  if (status === 'CONCLUIDO') {
    return { label: 'Concluído', tone: 'success' as const, days: null };
  }
  if (!prazoEm) {
    return { label: 'Sem prazo', tone: 'neutral' as const, days: null };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const prazo = new Date(prazoEm);
  prazo.setHours(0, 0, 0, 0);
  const days = Math.round((prazo.getTime() - today.getTime()) / 86_400_000);

  if (days < 0) {
    return { label: 'Vencida', tone: 'danger' as const, days };
  }
  if (days === 0) {
    return { label: 'Vence hoje', tone: 'danger' as const, days };
  }
  if (days <= 2) {
    return { label: `${days} dia${days > 1 ? 's' : ''}`, tone: 'warning' as const, days };
  }
  return { label: `${days} dias`, tone: 'neutral' as const, days };
}

export type ChamadoTimelineStep = {
  title: string;
  date: string;
  sub?: string;
  done: boolean;
  active: boolean;
};

export type ChamadoHistoricoEntry = {
  statusAnterior?: string | null;
  statusNovo: string;
  motivo?: string | null;
  createdAt: string;
  alteradoPor?: { nome: string } | null;
};

function formatTimelineDate(value?: string | null) {
  return value ? new Date(value).toLocaleString('pt-BR') : '—';
}

export function buildChamadoTimelineFromHistorico(
  historico: ChamadoHistoricoEntry[],
  currentStatus: string,
  createdAt: string,
): ChamadoTimelineStep[] {
  if (historico.length === 0) {
    return [
      {
        title: chamadoStatusLabel('ABERTO'),
        date: formatTimelineDate(createdAt),
        sub: 'Registro inicial',
        done: true,
        active: currentStatus === 'ABERTO',
      },
    ];
  }

  return historico.map((entry, index) => {
    const isLast = index === historico.length - 1;
    const assignmentOnly = entry.statusAnterior && entry.statusAnterior === entry.statusNovo;
    const title = assignmentOnly
      ? 'Atribuição atualizada'
      : entry.statusAnterior
        ? `${chamadoStatusLabel(entry.statusAnterior)} → ${chamadoStatusLabel(entry.statusNovo)}`
        : chamadoStatusLabel(entry.statusNovo);
    const sub = [entry.alteradoPor?.nome, entry.motivo].filter(Boolean).join(' · ');

    return {
      title,
      date: formatTimelineDate(entry.createdAt),
      sub: sub || undefined,
      done: !isLast || entry.statusNovo === currentStatus,
      active: isLast && entry.statusNovo === currentStatus,
    };
  });
}

export function buildChamadoTimeline(
  status: string,
  abertoEm: string,
  prazoEm: string | null | undefined,
  concluidoEm: string | null | undefined,
  responsavel?: string | null,
  prioridade?: string,
  origem?: string,
): ChamadoTimelineStep[] {
  const doneFrom = (step: string) => {
    const order = ['ABERTO', 'EM_TRIAGEM', 'EM_ATENDIMENTO', 'IMPEDIDO', 'CONCLUIDO'];
    const current = status === 'CANCELADO' ? 'ABERTO' : status;
    return order.indexOf(current) >= order.indexOf(step);
  };

  const formatDate = (value?: string | null) =>
    value ? new Date(value).toLocaleDateString('pt-BR') : '—';

  const atendimentoTitle = status === 'IMPEDIDO' ? 'Impedido' : 'Em atendimento';
  const atendimentoActive = status === 'EM_ATENDIMENTO' || status === 'IMPEDIDO';

  return [
    {
      title: 'Aberto',
      date: formatDate(abertoEm),
      sub: origem,
      done: doneFrom('ABERTO'),
      active: status === 'ABERTO',
    },
    {
      title: 'Triagem',
      date: formatDate(abertoEm),
      sub: prioridade ? `Prioridade ${prioridade}` : undefined,
      done: doneFrom('EM_TRIAGEM'),
      active: status === 'EM_TRIAGEM',
    },
    {
      title: atendimentoTitle,
      date: '—',
      sub: responsavel ?? 'Aguardando responsável',
      done: doneFrom('EM_ATENDIMENTO') || status === 'IMPEDIDO',
      active: atendimentoActive,
    },
    {
      title: 'Concluído',
      date: formatDate(concluidoEm ?? (status === 'CONCLUIDO' ? prazoEm : null)),
      done: status === 'CONCLUIDO',
      active: false,
    },
  ];
}
