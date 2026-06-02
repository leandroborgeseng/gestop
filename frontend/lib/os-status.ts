export const OS_STATUS_META: Record<
  string,
  { label: string; badge: 'info' | 'warning' | 'brand' | 'success' | 'muted' | 'danger' }
> = {
  ABERTA: { label: 'Aberta', badge: 'info' },
  EM_TRIAGEM: { label: 'Em triagem', badge: 'warning' },
  ATRIBUIDA: { label: 'Atribuída', badge: 'brand' },
  EM_EXECUCAO: { label: 'Em execução', badge: 'brand' },
  IMPEDIDA: { label: 'Impedida', badge: 'danger' },
  CONCLUIDA: { label: 'Concluída', badge: 'success' },
  CANCELADA: { label: 'Cancelada', badge: 'muted' },
};

export function osStatusLabel(status: string) {
  return OS_STATUS_META[status]?.label ?? status;
}

export function nextOsStatuses(status: string) {
  const transitions: Record<string, string[]> = {
    ABERTA: ['EM_TRIAGEM', 'ATRIBUIDA', 'CANCELADA'],
    EM_TRIAGEM: ['ATRIBUIDA', 'CANCELADA'],
    ATRIBUIDA: ['EM_EXECUCAO', 'IMPEDIDA', 'CANCELADA'],
    EM_EXECUCAO: ['CONCLUIDA', 'IMPEDIDA'],
    IMPEDIDA: ['ATRIBUIDA', 'EM_EXECUCAO', 'CANCELADA'],
    CONCLUIDA: [],
    CANCELADA: [],
  };
  return transitions[status] ?? [];
}

export function nextOsStatusFlow(status: string) {
  const flow = ['ABERTA', 'EM_TRIAGEM', 'ATRIBUIDA', 'EM_EXECUCAO', 'CONCLUIDA'];
  const index = flow.indexOf(status);
  if (index === -1 || status === 'IMPEDIDA') return null;
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
  if (status === 'CONCLUIDA') {
    return { label: 'Concluída', tone: 'success' as const, days: null };
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

export type OsTimelineStep = {
  title: string;
  date: string;
  sub?: string;
  done: boolean;
  active: boolean;
};

export function buildOsTimeline(
  status: string,
  abertaEm: string,
  prazoEm: string | null | undefined,
  concluidaEm: string | null | undefined,
  responsavel?: string | null,
  prioridade?: string,
  origem?: string,
): OsTimelineStep[] {
  const doneFrom = (step: string) => {
    const order = ['ABERTA', 'EM_TRIAGEM', 'ATRIBUIDA', 'EM_EXECUCAO', 'IMPEDIDA', 'CONCLUIDA'];
    const current = status === 'CANCELADA' ? 'ABERTA' : status;
    return order.indexOf(current) >= order.indexOf(step);
  };

  const formatDate = (value?: string | null) =>
    value ? new Date(value).toLocaleDateString('pt-BR') : '—';

  const execTitle = status === 'IMPEDIDA' ? 'Impedida' : 'Em execução';
  const execActive = status === 'EM_EXECUCAO' || status === 'IMPEDIDA';

  return [
    {
      title: 'Aberta',
      date: formatDate(abertaEm),
      sub: origem,
      done: doneFrom('ABERTA'),
      active: status === 'ABERTA',
    },
    {
      title: 'Triada e priorizada',
      date: formatDate(abertaEm),
      sub: prioridade ? `Prioridade ${prioridade}` : undefined,
      done: doneFrom('EM_TRIAGEM'),
      active: status === 'EM_TRIAGEM',
    },
    {
      title: 'Atribuída',
      date: '—',
      sub: responsavel ?? 'Aguardando responsável',
      done: doneFrom('ATRIBUIDA'),
      active: status === 'ATRIBUIDA',
    },
    {
      title: execTitle,
      date: '—',
      done: doneFrom('EM_EXECUCAO') || status === 'IMPEDIDA',
      active: execActive,
    },
    {
      title: 'Concluída',
      date: formatDate(concluidaEm ?? (status === 'CONCLUIDA' ? prazoEm : null)),
      done: status === 'CONCLUIDA',
      active: false,
    },
  ];
}
