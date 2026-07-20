import { ChamadoResumo, ChamadoStatus } from '@/lib/types';
import { prazoInfo } from '@/lib/chamado-status';

export type SlaFilter = 'TODOS' | 'DENTRO' | 'FORA' | 'SEM';

export function chamadoMatchesStatusMulti(chamado: ChamadoResumo, statuses: Set<ChamadoStatus> | 'TODOS') {
  if (statuses === 'TODOS' || statuses.size === 0) return true;
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
