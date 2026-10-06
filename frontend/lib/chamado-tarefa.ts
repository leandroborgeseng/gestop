import type { ChamadoMapPoint } from './types';

export type ChamadoTarefaStatus = 'NOVA' | 'VISUALIZADA' | 'EM_ANDAMENTO' | 'IMPEDIDA' | 'CONCLUIDA' | 'CANCELADA';

export const TAREFA_STATUS_LABEL: Record<ChamadoTarefaStatus, string> = {
  NOVA: 'Nova',
  VISUALIZADA: 'Visualizada',
  EM_ANDAMENTO: 'Em andamento',
  IMPEDIDA: 'Impedida',
  CONCLUIDA: 'Concluída',
  CANCELADA: 'Cancelada',
};

export const TAREFA_STATUS_PENDENTES: ChamadoTarefaStatus[] = ['NOVA', 'VISUALIZADA', 'EM_ANDAMENTO'];
export const TAREFA_STATUS_FINAIS: ChamadoTarefaStatus[] = ['CONCLUIDA', 'CANCELADA'];

export function tarefaEncerrada(status: ChamadoTarefaStatus) {
  return TAREFA_STATUS_FINAIS.includes(status);
}

export function agruparTarefasDoChamado<T extends { status: ChamadoTarefaStatus }>(items: T[]) {
  const abertas: T[] = [];
  const encerradas: T[] = [];
  for (const item of items) {
    if (tarefaEncerrada(item.status)) encerradas.push(item);
    else abertas.push(item);
  }
  return { abertas, encerradas };
}

export function contarTarefasPendentes<T extends { status: ChamadoTarefaStatus }>(items: T[]) {
  return items.filter((item) => TAREFA_STATUS_PENDENTES.includes(item.status)).length;
}

export function formatarDataCriacaoTarefa(iso: string) {
  const date = new Date(iso);
  return `Criada em ${date.toLocaleDateString('pt-BR')} às ${date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
}

export const TAREFA_PRIORIDADE_LABEL: Record<string, string> = {
  BAIXA: 'Baixa',
  MEDIA: 'Média',
  ALTA: 'Alta',
  URGENTE: 'Urgente',
};

export type ChamadoTarefaResumo = {
  id: string;
  titulo: string;
  descricao: string | null;
  prazo: string | null;
  prioridade: string;
  status: ChamadoTarefaStatus;
  justificativa: string | null;
  conclusaoTexto: string | null;
  observacao: string | null;
  atrasada: boolean;
  createdAt: string;
  concluidaEm: string | null;
  visualizadaEm: string | null;
  secretaria: { id: string; nome: string; sigla: string } | null;
  equipe: { id: string; nome: string; codigo?: string } | null;
  responsavel: { id: string; nome: string; email?: string } | null;
  criadaPor: { id: string; nome: string } | null;
  concluidaPor: { id: string; nome: string } | null;
  anexos: Array<{ id: string; nome: string; url: string; mimeType: string | null; tamanhoBytes: number | null; createdAt: string }>;
  podeAlterarDados?: boolean;
  podeAndamento?: boolean;
  podeConcluir?: boolean;
  podeCancelar?: boolean;
  podeVerHistorico?: boolean;
  podeVerAnexos?: boolean;
  podeTratar: boolean;
  chamado: {
    id: string;
    codigo: string;
    titulo: string | null;
    descricao: string;
    status: string;
    prioridade: string;
    enderecoTexto: string | null;
    prazoEm: string | null;
    latitude: number | null;
    longitude: number | null;
    tipoChamado: { id: string; nome: string } | null;
    unidade: { id: string; nome: string; endereco: string } | null;
    secretaria: { id: string; nome: string; sigla: string } | null;
    equipe: { id: string; nome: string } | null;
  };
};

export type ChamadoTarefaChamadoLeitura = {
  chamadoId: string;
  codigo: string;
  somenteLeitura: true;
  anexosAbertura: Array<{
    id: string;
    nome: string;
    mimeType?: string | null;
    categoria: 'imagem' | 'pdf' | 'video';
    url: string;
    tamanhoBytes?: number | null;
    enviadoEm?: string | null;
  }>;
  historico: Array<{
    id: string;
    motivo: string | null;
    statusAnterior: string | null;
    statusNovo: string;
    createdAt: string;
    alteradoPor: { id: string; nome: string } | null;
    metadata?: Record<string, unknown>;
    anexos?: Array<{ id: string; url: string; mimeType?: string | null; descricao?: string | null; nome?: string | null }>;
  }>;
};

export type ChamadoTarefaDetalhe = ChamadoTarefaResumo & {
  historico: Array<{
    id: string;
    motivo: string | null;
    statusAnterior: string | null;
    statusNovo: string;
    createdAt: string;
    alteradoPor: { id: string; nome: string } | null;
    acao?: string | null;
    perfil?: string | null;
    secretaria?: string | null;
    temAnexos?: boolean;
    anexoIds?: string[];
  }>;
};

export type TarefasExecucaoResponse = {
  total: number;
  contadores: { novas: number; emAndamento: number; atrasadas: number };
  items: ChamadoTarefaResumo[];
};

export type GrupoIndicadoresTarefas = {
  nome: string;
  total: number;
  pendentes: number;
  atrasadas: number;
};

export type RelatorioTarefasResponse = {
  indicadores: {
    abertas: number;
    novas: number;
    emAndamento: number;
    impedidas: number;
    concluidas: number;
    atrasadas: number;
    porSecretaria: GrupoIndicadoresTarefas[];
    porEquipe: GrupoIndicadoresTarefas[];
    porResponsavel: GrupoIndicadoresTarefas[];
    porTipoChamado: GrupoIndicadoresTarefas[];
  };
  items: Array<ChamadoTarefaResumo & { situacaoPrazo: string }>;
};

const RESUMO_CHAMADO_MAX = 60;

export function resumoDoChamado(
  chamado: { titulo?: string | null; descricao?: string | null },
  maxLen = RESUMO_CHAMADO_MAX,
) {
  const titulo = chamado.titulo?.replace(/\s+/g, ' ').trim();
  const descricao = (chamado.descricao ?? '').replace(/\s+/g, ' ').trim();
  const fonte = titulo || descricao;
  if (!fonte) return '—';
  if (fonte.length <= maxLen) return fonte;
  return `${fonte.slice(0, maxLen).trimEnd()}…`;
}

export function tarefaExecucaoToMapPoint(item: ChamadoTarefaResumo): ChamadoMapPoint | null {
  if (item.chamado.latitude == null || item.chamado.longitude == null) return null;
  return {
    id: item.id,
    codigo: item.chamado.codigo,
    titulo: item.titulo,
    latitude: item.chamado.latitude,
    longitude: item.chamado.longitude,
    unidadeNome: `Tarefa · ${item.chamado.unidade?.nome || item.chamado.enderecoTexto || 'Sem endereço'}`,
    prioridade: TAREFA_PRIORIDADE_LABEL[item.prioridade] ?? item.prioridade,
    equipeNome: item.equipe?.nome,
    prazoEm: item.prazo,
    responsavelNome: item.responsavel?.nome ?? null,
  };
}

export type FiltrosTarefasExecucaoResumo = {
  status?: string;
  historico?: boolean;
  secretariaSigla?: string;
  equipeNome?: string;
  responsavelNome?: string;
  tipoNome?: string;
  prioridade?: string;
  atribuidaAMim?: boolean;
  minhasEquipes?: boolean;
  atrasadas?: boolean;
  prazoFrom?: string;
  prazoTo?: string;
};

export function resumoFiltrosTarefasExecucao(opts: FiltrosTarefasExecucaoResumo) {
  const partes: string[] = [];
  if (opts.status === 'IMPEDIDA') partes.push('Status: Impedida (histórico)');
  else if (opts.status) partes.push(`Status: ${TAREFA_STATUS_LABEL[opts.status as ChamadoTarefaStatus] ?? opts.status}`);
  else if (opts.historico) partes.push('Status: histórico');
  else if (opts.status === '') partes.push('Status: não finalizados');
  if (opts.secretariaSigla) partes.push(`Secretaria: ${opts.secretariaSigla}`);
  if (opts.equipeNome) partes.push(`Equipe: ${opts.equipeNome}`);
  if (opts.responsavelNome) partes.push(`Responsável: ${opts.responsavelNome}`);
  if (opts.tipoNome) partes.push(`Tipo: ${opts.tipoNome}`);
  if (opts.prioridade) partes.push(`Prioridade: ${TAREFA_PRIORIDADE_LABEL[opts.prioridade] ?? opts.prioridade}`);
  if (opts.atribuidaAMim) partes.push('Atribuídas a mim');
  if (opts.minhasEquipes) partes.push('Minhas equipes');
  if (opts.atrasadas) partes.push('Atrasadas');
  if (opts.prazoFrom || opts.prazoTo) partes.push('Prazo');
  return partes.length ? partes.join(' · ') : 'Nenhum filtro ativo';
}

export type FiltrosRelatorioTarefasInput = {
  from?: string;
  to?: string;
  status?: string;
  prioridade?: string;
  secretariaId?: string;
  equipeId?: string;
  responsavelId?: string;
  tipoChamadoId?: string;
  search?: string;
  capa: 'simples' | 'formal';
};

export function montarFiltrosRelatorioTarefas(input: FiltrosRelatorioTarefasInput) {
  return {
    from: input.from || undefined,
    to: input.to || undefined,
    status: input.status || undefined,
    prioridade: input.prioridade || undefined,
    secretariaId: input.secretariaId || undefined,
    equipeId: input.equipeId || undefined,
    responsavelId: input.responsavelId || undefined,
    tipoChamadoId: input.tipoChamadoId || undefined,
    search: input.search?.trim() || undefined,
    capa: input.capa,
  };
}

export function formatarGrupoIndicadoresTarefas(item: Pick<GrupoIndicadoresTarefas, 'nome' | 'pendentes' | 'atrasadas'>) {
  return `${item.nome}: ${item.pendentes} pendentes · ${item.atrasadas} atrasadas`;
}
