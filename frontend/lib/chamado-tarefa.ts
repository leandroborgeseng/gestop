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
    /** 293: texto digitado no evento (andamento/conclusão/cancelamento). null em registros antigos. */
    texto?: string | null;
    /** 293: 'evento' (novo), 'conclusao' (conclusaoTexto legado) ou 'registro_anterior' (resumo legado). */
    textoOrigem?: 'evento' | 'conclusao' | 'registro_anterior' | null;
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

/** UX-01: o mesmo teto da grade, do modal formal e do export PDF/CSV/XLSX. */
export const TETO_LINHAS_RELATORIO_TAREFAS = 500;

/**
 * Aviso quando o filtro passa do teto. Com total ≤ teto, não há aviso.
 * O número mostrado é o que a consulta devolveu, no máximo o teto.
 */
export function avisoCorteRelatorioTarefas(
  total: number,
  exibidas: number,
  teto = TETO_LINHAS_RELATORIO_TAREFAS,
): string | null {
  if (!Number.isFinite(total) || total <= teto) return null;
  const mostradas = Math.min(Math.max(0, exibidas), teto);
  return `Mostrando ${mostradas} de ${total} tarefas`;
}

export type RelatorioTarefasResponse = {
  /** Quantidade no filtro, sem o teto de linhas. */
  total: number;
  limite: number;
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
    resumoChamado: resumoDoChamado(item.chamado),
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
  const prazo = textoPrazoFiltro(opts.prazoFrom, opts.prazoTo);
  if (prazo) partes.push(prazo);
  return partes.length ? partes.join(' · ') : 'Nenhum filtro ativo';
}

/** UX-02: resumo da sanfona com as datas do prazo (dd/mm). */
export function textoPrazoFiltro(from?: string, to?: string): string | null {
  const de = dataCivilCurta(from);
  const ate = dataCivilCurta(to);
  if (de && ate) return `Prazo: ${de} a ${ate}`;
  if (de) return `Prazo: a partir de ${de}`;
  if (ate) return `Prazo: até ${ate}`;
  return null;
}

function dataCivilCurta(valor?: string) {
  const texto = valor?.trim();
  if (!texto) return '';
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(texto);
  if (!match) return texto;
  return `${match[3]}/${match[2]}`;
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

export function rotuloContagem(n: number, um: string, varios: string) {
  return `${n} ${n === 1 ? um : varios}`;
}

export function formatarGrupoIndicadoresTarefas(item: Pick<GrupoIndicadoresTarefas, 'nome' | 'pendentes' | 'atrasadas'>) {
  return `${item.nome} — ${rotuloContagem(item.pendentes, 'pendente', 'pendentes')}, ${rotuloContagem(item.atrasadas, 'atrasada', 'atrasadas')}`;
}

/** UX-04: pendências primeiro — atrasadas, depois pendentes, depois o nome. */
export const LIMITE_GRUPOS_VISIVEIS = 6;

export function ordenarGruposPendencias<T extends Pick<GrupoIndicadoresTarefas, 'nome' | 'pendentes' | 'atrasadas'>>(
  itens: readonly T[],
): T[] {
  return [...itens].sort(
    (a, b) => b.atrasadas - a.atrasadas || b.pendentes - a.pendentes || a.nome.localeCompare(b.nome, 'pt-BR'),
  );
}

/** Rodapé quando a lista corta. Null se tudo já está visível. */
export function textoCorteGrupos(total: number, visiveis = LIMITE_GRUPOS_VISIVEIS): string | null {
  const outras = total - visiveis;
  if (outras <= 0) return null;
  return `+${outras} outras`;
}
