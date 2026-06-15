export const CHAMADO_STATUS_META: Record<
  string,
  { label: string; badge: 'info' | 'warning' | 'brand' | 'success' | 'muted' | 'danger' }
> = {
  ABERTO: { label: 'Aberto', badge: 'info' },
  EM_TRIAGEM: { label: 'Em triagem', badge: 'warning' },
  EM_ATENDIMENTO: { label: 'Em atendimento', badge: 'brand' },
  EM_EXECUCAO: { label: 'Em execução', badge: 'warning' },
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
  const flow = ['ABERTO', 'EM_TRIAGEM', 'EM_ATENDIMENTO', 'EM_EXECUCAO', 'CONCLUIDO'];
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

export function previstaExecucaoInfo(previstaExecucaoEm: string | null | undefined, status: string) {
  if (status === 'CONCLUIDO' || status === 'CANCELADO') {
    return { label: '—', tone: 'neutral' as const, date: null };
  }
  if (!previstaExecucaoEm) {
    return { label: 'Sem data', tone: 'neutral' as const, date: null };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const prevista = new Date(previstaExecucaoEm);
  prevista.setHours(0, 0, 0, 0);
  const days = Math.round((prevista.getTime() - today.getTime()) / 86_400_000);
  const formatted = prevista.toLocaleDateString('pt-BR');

  if (days === 0) return { label: `Hoje · ${formatted}`, tone: 'warning' as const, date: formatted };
  if (days === 1) return { label: `Amanhã · ${formatted}`, tone: 'brand' as const, date: formatted };
  if (days < 0) return { label: `${Math.abs(days)}d atrás · ${formatted}`, tone: 'danger' as const, date: formatted };
  if (days <= 7) return { label: `Em ${days}d · ${formatted}`, tone: 'neutral' as const, date: formatted };
  return { label: formatted, tone: 'neutral' as const, date: formatted };
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
  id?: string;
  title: string;
  date: string;
  sub?: string;
  done: boolean;
  active: boolean;
  expand?: {
    descricao?: string;
    alteracoes?: Array<{ campo: string; label: string; de: string; para: string }>;
    detalhes?: Array<{ label: string; value: string }>;
    anexos?: Array<{ id: string; url: string; mimeType?: string | null; nome?: string | null }>;
    usuario?: string;
    dataHora?: string;
  };
};

export type ChamadoHistoricoEntry = {
  id?: string;
  statusAnterior?: string | null;
  statusNovo: string;
  motivo?: string | null;
  createdAt: string;
  alteradoPor?: { nome: string } | null;
  metadata?: Record<string, unknown> | null;
  anexos?: Array<{ id: string; url: string; mimeType?: string | null; descricao?: string | null }>;
};

function formatTimelineDate(value?: string | null) {
  return value ? new Date(value).toLocaleString('pt-BR') : '—';
}

function mapHistoricoAnexos(entry: ChamadoHistoricoEntry) {
  return (entry.anexos ?? []).map((item) => ({
    id: item.id,
    url: item.url,
    mimeType: item.mimeType,
    nome: item.descricao,
  }));
}

function buildExecucaoConclusaoStep(
  entry: ChamadoHistoricoEntry,
  metadata: Record<string, unknown>,
  isLast: boolean,
  currentStatus: string,
): ChamadoTimelineStep {
  const impedimento = entry.statusNovo === 'IMPEDIDO' || metadata.impedimento === true;
  const relatorio =
    typeof metadata.relatorio === 'string' && metadata.relatorio.trim()
      ? metadata.relatorio.trim()
      : impedimento && entry.motivo?.startsWith('Execução impedida:')
        ? entry.motivo.replace(/^Execução impedida:\s*/, '').trim()
        : entry.motivo?.trim() || '';
  const distanciaMetros = typeof metadata.distanciaMetros === 'number' ? metadata.distanciaMetros : null;
  const evidenciasCount = typeof metadata.evidenciasCount === 'number' ? metadata.evidenciasCount : null;
  const anexos = mapHistoricoAnexos(entry);
  const detalhes: Array<{ label: string; value: string }> = [];

  if (impedimento && typeof metadata.impedimentoMotivo === 'string' && metadata.impedimentoMotivo.trim()) {
    detalhes.push({ label: 'Motivo do impedimento', value: metadata.impedimentoMotivo.trim() });
  }
  if (distanciaMetros != null) {
    detalhes.push({ label: 'Distância do check-out', value: `${Math.round(distanciaMetros)} m do ponto` });
  }
  if (evidenciasCount != null) {
    detalhes.push({ label: 'Evidências registradas', value: `${evidenciasCount} foto(s)` });
  }

  const expandContent = {
    descricao: relatorio || undefined,
    detalhes: detalhes.length ? detalhes : undefined,
    anexos: anexos.length ? anexos : undefined,
    usuario: entry.alteradoPor?.nome,
    dataHora: formatTimelineDate(entry.createdAt),
  };
  const hasExpand = Boolean(
    expandContent.descricao || expandContent.detalhes?.length || expandContent.anexos?.length,
  );

  return {
    id: entry.id,
    title: impedimento ? 'Execução impedida em campo' : 'Execução concluída em campo',
    date: formatTimelineDate(entry.createdAt),
    sub: entry.alteradoPor?.nome,
    done: true,
    active: isLast && entry.statusNovo === currentStatus,
    expand: hasExpand ? expandContent : undefined,
  };
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
    const metadata = entry.metadata ?? {};
    const tipo = typeof metadata.tipo === 'string' ? metadata.tipo : null;

    if (tipo === 'HISTORY_UPDATE') {
      return {
        id: entry.id,
        title: 'Atualização de histórico',
        date: formatTimelineDate(entry.createdAt),
        done: true,
        active: false,
        expand: {
          descricao: typeof metadata.descricao === 'string' ? metadata.descricao : undefined,
          anexos: mapHistoricoAnexos(entry),
          usuario: entry.alteradoPor?.nome,
          dataHora: formatTimelineDate(entry.createdAt),
        },
      };
    }

    if (tipo === 'programacao_update' || entry.motivo === 'Programação de execução atualizada.') {
      const alteracoes = Array.isArray(metadata.alteracoes)
        ? (metadata.alteracoes as Array<{ campo: string; label: string; de: string; para: string }>)
        : [];
      return {
        id: entry.id,
        title: 'Programação de execução atualizada',
        date: formatTimelineDate(entry.createdAt),
        sub: entry.alteradoPor?.nome,
        done: true,
        active: false,
        expand: alteracoes.length
          ? {
              alteracoes,
              usuario: entry.alteradoPor?.nome,
              dataHora: formatTimelineDate(entry.createdAt),
            }
          : undefined,
      };
    }

    if (tipo === 'triagem_update' || entry.motivo === 'Triagem atualizada.') {
      const alteracoes = Array.isArray(metadata.alteracoes)
        ? (metadata.alteracoes as Array<{ campo: string; label: string; de: string; para: string }>)
        : [];
      return {
        id: entry.id,
        title: 'Triagem atualizada',
        date: formatTimelineDate(entry.createdAt),
        sub: entry.alteradoPor?.nome,
        done: true,
        active: false,
        expand: alteracoes.length
          ? {
              alteracoes,
              usuario: entry.alteradoPor?.nome,
              dataHora: formatTimelineDate(entry.createdAt),
            }
          : undefined,
      };
    }

    if (tipo === 'execucao_conclusao') {
      return buildExecucaoConclusaoStep(entry, metadata, isLast, currentStatus);
    }

    if (
      entry.statusNovo === 'CONCLUIDO' &&
      entry.motivo === 'Execução concluída em campo.' &&
      typeof metadata.relatorio === 'string'
    ) {
      return buildExecucaoConclusaoStep(entry, metadata, isLast, currentStatus);
    }

    if (
      entry.statusNovo === 'IMPEDIDO' &&
      entry.motivo?.startsWith('Execução impedida:') &&
      typeof metadata.relatorio === 'string'
    ) {
      return buildExecucaoConclusaoStep(entry, metadata, isLast, currentStatus);
    }

    const assignmentOnly = entry.statusAnterior && entry.statusAnterior === entry.statusNovo;
    const title = assignmentOnly
      ? 'Atribuição atualizada'
      : entry.statusAnterior
        ? `${chamadoStatusLabel(entry.statusAnterior)} → ${chamadoStatusLabel(entry.statusNovo)}`
        : chamadoStatusLabel(entry.statusNovo);
    const sub = [entry.alteradoPor?.nome, entry.motivo].filter(Boolean).join(' · ');

    return {
      id: entry.id,
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
