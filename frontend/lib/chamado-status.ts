export const CHAMADO_STATUS_META: Record<
  string,
  { label: string; badge: 'info' | 'warning' | 'brand' | 'success' | 'muted' | 'danger' }
> = {
  ABERTO: { label: 'Aberto', badge: 'info' },
  EM_TRIAGEM: { label: 'Em triagem', badge: 'warning' },
  EM_AVALIACAO_TECNICA: { label: 'Em avaliação técnica', badge: 'brand' },
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
  const flow = ['ABERTO', 'EM_TRIAGEM', 'EM_AVALIACAO_TECNICA', 'EM_ATENDIMENTO', 'EM_EXECUCAO', 'CONCLUIDO'];
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
    return {
      label: 'Concluído',
      value: 'Concluído',
      sub: undefined,
      tone: 'success' as const,
      days: null,
      date: null,
    };
  }
  if (!prazoEm) {
    return {
      label: 'Sem prazo',
      value: 'Sem prazo',
      sub: undefined,
      tone: 'neutral' as const,
      days: null,
      date: null,
    };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const prazo = new Date(prazoEm);
  prazo.setHours(0, 0, 0, 0);
  const days = Math.round((prazo.getTime() - today.getTime()) / 86_400_000);
  const date = prazo.toLocaleDateString('pt-BR');

  let sub: string;
  let tone: 'neutral' | 'warning' | 'danger' | 'success';
  if (days < 0) {
    sub = `${Math.abs(days)} dia${Math.abs(days) > 1 ? 's' : ''} em atraso`;
    tone = 'danger';
  } else if (days === 0) {
    sub = 'Vence hoje';
    tone = 'danger';
  } else if (days <= 2) {
    sub = `${days} dia${days > 1 ? 's' : ''} restante${days > 1 ? 's' : ''}`;
    tone = 'warning';
  } else {
    sub = `${days} dias de prazo`;
    tone = 'neutral';
  }

  return { label: date, value: date, sub, tone, days, date };
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

function timelineSubComResponsavel(
  alteradoPor: string | undefined,
  alteracoes: Array<{ campo: string; label: string; de: string; para: string }>,
) {
  const responsavelAlteracao = alteracoes.find((item) => item.campo === 'responsavel');
  const equipeAlteracao = alteracoes.find((item) => item.campo === 'equipe');
  const destaque = responsavelAlteracao?.para ?? equipeAlteracao?.para;
  return [alteradoPor, destaque].filter(Boolean).join(' · ');
}

function isAtribuicaoMotivo(motivo: string | null | undefined) {
  return (
    motivo === 'Atribuição de equipe/responsável atualizada.' ||
    motivo === 'Atribuição de equipe atualizada.'
  );
}

function formatParticipanteLinha(
  value: unknown,
  opts?: { externo?: boolean },
): string | null {
  if (typeof value === 'string' && value.trim()) {
    return opts?.externo ? `• ${value.trim()} — membro externo` : `• ${value.trim()}`;
  }
  if (!value || typeof value !== 'object') return null;
  const item = value as {
    nome?: unknown;
    cargo?: unknown;
    origem?: unknown;
  };
  if (typeof item.nome !== 'string' || !item.nome.trim()) return null;
  const nome = item.nome.trim();
  const isExterno = opts?.externo || item.origem === 'externo';
  const cargo = typeof item.cargo === 'string' && item.cargo.trim() ? item.cargo.trim() : null;
  if (isExterno) {
    return cargo ? `• ${nome} — ${cargo} (membro externo)` : `• ${nome} — membro externo`;
  }
  return cargo ? `• ${nome} — ${cargo}` : `• ${nome}`;
}

function buildParticipantesExecucaoDetalhe(metadata: Record<string, unknown>): { label: string; value: string } {
  const linhas: string[] = [];

  const equipe = Array.isArray(metadata.membrosExecutores) ? metadata.membrosExecutores : [];
  for (const item of equipe) {
    const linha = formatParticipanteLinha(item, { externo: false });
    if (linha) linhas.push(linha);
  }

  const externos = Array.isArray(metadata.membrosExternos) ? metadata.membrosExternos : [];
  for (const item of externos) {
    const linha = formatParticipanteLinha(item, { externo: true });
    if (linha) linhas.push(linha);
  }

  // Formato unificado gravado em conclusões mais novas.
  if (linhas.length === 0 && Array.isArray(metadata.participantes)) {
    for (const item of metadata.participantes) {
      const linha = formatParticipanteLinha(item);
      if (linha) linhas.push(linha);
    }
  }

  return {
    label: 'Participantes da execução',
    value: linhas.length > 0 ? linhas.join('\n') : 'Nenhum participante informado',
  };
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
  const anexos = mapHistoricoAnexos(entry);
  const detalhes: Array<{ label: string; value: string }> = [];
  const motivoImpedimento =
    typeof metadata.impedimentoMotivo === 'string' ? metadata.impedimentoMotivo.trim() : '';

  if (impedimento && motivoImpedimento && !relatorio.includes(motivoImpedimento)) {
    detalhes.push({ label: 'Motivo do impedimento', value: motivoImpedimento });
  }
  if (distanciaMetros != null) {
    detalhes.push({ label: 'Distância do check-out', value: `${Math.round(distanciaMetros)} m do ponto` });
  }
  if (anexos.length > 0) {
    detalhes.push({ label: 'Evidências registradas', value: `${anexos.length} foto(s)` });
  } else if (typeof metadata.evidenciasCount === 'number' && metadata.evidenciasCount > 0) {
    detalhes.push({ label: 'Evidências registradas', value: `${metadata.evidenciasCount} foto(s)` });
  }

  const equipe =
    metadata.equipeExecutora && typeof metadata.equipeExecutora === 'object'
      ? (metadata.equipeExecutora as { nome?: string; codigo?: string | null })
      : null;
  if (equipe?.nome) {
    detalhes.push({
      label: 'Equipe executora',
      value: equipe.codigo ? `${equipe.codigo} · ${equipe.nome}` : equipe.nome,
    });
  }

  detalhes.push(buildParticipantesExecucaoDetalhe(metadata));

  const checklistComplementar =
    metadata.checklistComplementar && typeof metadata.checklistComplementar === 'object'
      ? (metadata.checklistComplementar as {
          checklistNome?: string;
          dispensadoPorImpedimento?: boolean;
          respostas?: Array<{
            titulo?: string;
            naoSeAplica?: boolean;
            valorBooleano?: boolean | null;
            valorTexto?: string | null;
            valorNumero?: number | null;
            comentario?: string | null;
          }>;
        })
      : null;

  if (checklistComplementar?.dispensadoPorImpedimento) {
    detalhes.push({
      label: 'Checklist complementar',
      value: checklistComplementar.checklistNome
        ? `${checklistComplementar.checklistNome} · dispensado por impedimento`
        : 'Dispensado por impedimento',
    });
  } else if (checklistComplementar?.respostas?.length) {
    detalhes.push({
      label: checklistComplementar.checklistNome
        ? `Perguntas complementares (${checklistComplementar.checklistNome})`
        : 'Perguntas complementares da execução',
      value: checklistComplementar.respostas
        .map((resposta) => {
          const valor = resposta.naoSeAplica
            ? 'Não se aplica'
            : resposta.valorBooleano === true
              ? 'Sim'
              : resposta.valorBooleano === false
                ? 'Não'
                : resposta.valorTexto?.trim() ||
                  (resposta.valorNumero != null ? String(resposta.valorNumero) : '—');
          const comentario = resposta.comentario?.trim();
          return `${resposta.titulo ?? 'Pergunta'}: ${valor}${comentario ? ` (${comentario})` : ''}`;
        })
        .join(' · '),
    });
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
    title: impedimento
      ? 'Execução impedida em campo'
      : metadata.tipo === 'execucao_manual'
        ? 'Execução lançada manualmente'
        : 'Execução concluída em campo',
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
        sub: timelineSubComResponsavel(entry.alteradoPor?.nome, alteracoes),
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

    if (tipo === 'abertura_update' || entry.motivo === 'Informações de abertura atualizadas.') {
      const alteracoes = Array.isArray(metadata.alteracoes)
        ? (metadata.alteracoes as Array<{ campo: string; label: string; de: string; para: string }>)
        : [];
      return {
        id: entry.id,
        title: 'Informações de abertura atualizadas',
        date: formatTimelineDate(entry.createdAt),
        sub: timelineSubComResponsavel(entry.alteradoPor?.nome, alteracoes),
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

    if (tipo === 'atribuicao_update' || isAtribuicaoMotivo(entry.motivo)) {
      const alteracoes = Array.isArray(metadata.alteracoes)
        ? (metadata.alteracoes as Array<{ campo: string; label: string; de: string; para: string }>)
        : [];
      return {
        id: entry.id,
        title: 'Atribuição atualizada',
        date: formatTimelineDate(entry.createdAt),
        sub: timelineSubComResponsavel(entry.alteradoPor?.nome, alteracoes),
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

    if (tipo === 'execucao_conclusao' || tipo === 'execucao_manual') {
      return buildExecucaoConclusaoStep(entry, metadata, isLast, currentStatus);
    }

    if (
      entry.statusNovo === 'CONCLUIDO' &&
      (entry.motivo === 'Execução concluída em campo.' ||
        entry.motivo?.startsWith('Execução lançada manualmente.'))
    ) {
      return buildExecucaoConclusaoStep(entry, metadata, isLast, currentStatus);
    }

    if (entry.statusNovo === 'IMPEDIDO' && entry.motivo?.startsWith('Execução impedida:')) {
      return buildExecucaoConclusaoStep(entry, metadata, isLast, currentStatus);
    }

    const assignmentOnly = entry.statusAnterior && entry.statusAnterior === entry.statusNovo;
    if (assignmentOnly && Array.isArray(metadata.alteracoes) && metadata.alteracoes.length > 0) {
      const alteracoes = metadata.alteracoes as Array<{ campo: string; label: string; de: string; para: string }>;
      return {
        id: entry.id,
        title: 'Atribuição atualizada',
        date: formatTimelineDate(entry.createdAt),
        sub: timelineSubComResponsavel(entry.alteradoPor?.nome, alteracoes),
        done: true,
        active: false,
        expand: {
          alteracoes,
          usuario: entry.alteradoPor?.nome,
          dataHora: formatTimelineDate(entry.createdAt),
        },
      };
    }

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
