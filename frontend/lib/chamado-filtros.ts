import { ChamadoResumo, ChamadoStatus } from '@/lib/types';
import { prazoInfo } from '@/lib/chamado-status';

export type SlaFilter = 'TODOS' | 'DENTRO' | 'FORA' | 'SEM';

export type AtribuicaoFilter = 'TODOS' | 'MIM' | 'MINHA_EQUIPE';

export function chamadoMatchesStatusMulti(chamado: ChamadoResumo, statuses: Set<ChamadoStatus> | 'TODOS') {
  if (statuses === 'TODOS') return true;
  if (statuses.size === 0) return true;
  return statuses.has(chamado.status);
}

export function chamadoMatchesSla(chamado: ChamadoResumo, sla: SlaFilter) {
  if (sla === 'TODOS') return true;
  if (!chamado.prazoEm) return sla === 'SEM';
  const info = prazoInfo(chamado.prazoEm, chamado.status);
  if (sla === 'SEM') return false;
  if (sla === 'FORA') return info.tone === 'danger';
  return info.tone !== 'danger';
}

export function chamadoMatchesAtribuicao(
  chamado: ChamadoResumo,
  atribuicao: AtribuicaoFilter,
  opts: { userId?: string | null; minhaEquipeIds?: Set<string> | string[] },
) {
  if (atribuicao === 'TODOS') return true;
  if (atribuicao === 'MIM') {
    if (!opts.userId) return false;
    return chamado.responsavel?.id === opts.userId;
  }
  const ids = opts.minhaEquipeIds instanceof Set ? opts.minhaEquipeIds : new Set(opts.minhaEquipeIds ?? []);
  if (!chamado.equipe?.id || ids.size === 0) return false;
  return ids.has(chamado.equipe.id);
}

export type ChamadoFiltrosMatchOpts = {
  statuses?: Set<ChamadoStatus> | 'TODOS';
  prioridade?: string;
  sla?: SlaFilter;
  atribuicao?: AtribuicaoFilter;
  equipeId?: string;
  secretariaProprioId?: string;
  secretariaExecucaoId?: string;
  tipoChamadoId?: string;
  search?: string;
  userId?: string | null;
  minhaEquipeIds?: Set<string> | string[];
};

/** Aplica filtros de chamados; omita um grupo (ex.: status) para contadores de chips irmãos. */
export function chamadoMatchesFiltros(
  chamado: ChamadoResumo,
  opts: ChamadoFiltrosMatchOpts,
  exclude?: 'status' | 'prioridade' | 'sla' | 'atribuicao',
) {
  if (exclude !== 'status' && opts.statuses != null) {
    if (!chamadoMatchesStatusMulti(chamado, opts.statuses)) return false;
  }
  if (exclude !== 'prioridade' && opts.prioridade && opts.prioridade !== 'TODAS') {
    if (chamado.prioridade !== opts.prioridade) return false;
  }
  if (exclude !== 'sla' && opts.sla != null) {
    if (!chamadoMatchesSla(chamado, opts.sla)) return false;
  }
  if (exclude !== 'atribuicao' && opts.atribuicao != null && opts.atribuicao !== 'TODOS') {
    if (
      !chamadoMatchesAtribuicao(chamado, opts.atribuicao, {
        userId: opts.userId,
        minhaEquipeIds: opts.minhaEquipeIds,
      })
    ) {
      return false;
    }
  }
  if (opts.equipeId === 'sem-equipe') {
    if (chamado.equipe?.id) return false;
  } else if (opts.equipeId && chamado.equipe?.id !== opts.equipeId) {
    return false;
  }
  if (opts.secretariaProprioId && chamado.unidade?.secretaria?.id !== opts.secretariaProprioId) {
    return false;
  }
  if (opts.secretariaExecucaoId && chamado.secretaria?.id !== opts.secretariaExecucaoId) {
    return false;
  }
  if (opts.tipoChamadoId && chamado.tipoChamado?.id !== opts.tipoChamadoId) {
    return false;
  }
  const query = opts.search?.trim().toLowerCase();
  if (!query) return true;
  const haystack = [
    chamado.codigo,
    chamado.titulo,
    chamado.descricao,
    chamado.tipoChamado?.nome,
    chamado.unidade?.nome,
    chamado.unidade?.codigoPatrimonial,
    chamado.enderecoTexto,
    chamado.solicitanteNome,
    chamado.responsavel?.nome,
    chamado.equipe?.nome,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return haystack.includes(query);
}

export function countChamadosByStatus(
  chamados: ChamadoResumo[],
  opts: ChamadoFiltrosMatchOpts,
): Record<string, number> {
  const base = chamados.filter((item) => chamadoMatchesFiltros(item, opts, 'status'));
  const next: Record<string, number> = { TODOS: base.length };
  for (const item of base) {
    next[item.status] = (next[item.status] ?? 0) + 1;
  }
  return next;
}

export function collectSecretariasFromChamados(chamados: ChamadoResumo[]) {
  const proprio = new Map<string, { id: string; nome: string; sigla: string }>();
  const execucao = new Map<string, { id: string; nome: string; sigla: string }>();

  for (const chamado of chamados) {
    const secProprio = chamado.unidade?.secretaria;
    if (secProprio?.id) proprio.set(secProprio.id, secProprio);
    if (chamado.secretaria?.id) execucao.set(chamado.secretaria.id, chamado.secretaria);
  }

  const sortByNome = (a: { nome: string }, b: { nome: string }) => a.nome.localeCompare(b.nome, 'pt-BR');
  return {
    proprio: Array.from(proprio.values()).sort(sortByNome),
    execucao: Array.from(execucao.values()).sort(sortByNome),
  };
}

export function summarizeChamadoFiltros(opts: {
  statusTodos: boolean;
  statusCount: number;
  prioridade: string;
  sla: SlaFilter;
  atribuicao?: AtribuicaoFilter;
  equipe: string;
  secretariaProprio: string;
  secretariaExecucao: string;
  tipoChamado: string;
  tipoNome?: string;
  equipeNome?: string;
  secretariaProprioNome?: string;
  secretariaExecucaoNome?: string;
}) {
  const parts: string[] = [];
  if (!opts.statusTodos && opts.statusCount > 0) {
    parts.push(`${opts.statusCount} status`);
  }
  if (opts.prioridade !== 'TODAS') parts.push(`Prioridade ${opts.prioridade}`);
  if (opts.sla !== 'TODOS') {
    const slaLabel =
      opts.sla === 'DENTRO' ? 'Dentro do prazo' : opts.sla === 'FORA' ? 'Fora do prazo' : 'Sem SLA';
    parts.push(slaLabel);
  }
  if (opts.atribuicao === 'MIM') parts.push('Atribuídos a mim');
  else if (opts.atribuicao === 'MINHA_EQUIPE') parts.push('Atribuídos à minha equipe');
  if (opts.equipe === 'sem-equipe') parts.push('Sem equipe');
  else if (opts.equipe && opts.equipeNome) parts.push(opts.equipeNome);
  else if (opts.equipe) parts.push('Equipe');
  if (opts.secretariaProprio && opts.secretariaProprioNome) parts.push(`Próprio: ${opts.secretariaProprioNome}`);
  else if (opts.secretariaProprio) parts.push('Secretaria do próprio');
  if (opts.secretariaExecucao && opts.secretariaExecucaoNome) parts.push(`Execução: ${opts.secretariaExecucaoNome}`);
  else if (opts.secretariaExecucao) parts.push('Secretaria do chamado');
  if (opts.tipoChamado && opts.tipoNome) parts.push(opts.tipoNome);
  else if (opts.tipoChamado) parts.push('Tipo');
  return parts.length ? parts.join(' · ') : 'Nenhum filtro ativo';
}
