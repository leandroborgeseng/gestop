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

export type RelatorioTarefasResponse = {
  indicadores: {
    abertas: number;
    novas: number;
    emAndamento: number;
    impedidas: number;
    concluidas: number;
    atrasadas: number;
    porSecretaria: Array<{ nome: string; total: number }>;
    porEquipe: Array<{ nome: string; total: number }>;
    porResponsavel: Array<{ nome: string; total: number }>;
    porTipoChamado: Array<{ nome: string; total: number }>;
  };
  items: Array<ChamadoTarefaResumo & { situacaoPrazo: string }>;
};
