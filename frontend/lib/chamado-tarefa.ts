export type ChamadoTarefaStatus = 'NOVA' | 'VISUALIZADA' | 'EM_ANDAMENTO' | 'IMPEDIDA' | 'CONCLUIDA' | 'CANCELADA';

export const TAREFA_STATUS_LABEL: Record<ChamadoTarefaStatus, string> = {
  NOVA: 'Nova',
  VISUALIZADA: 'Visualizada',
  EM_ANDAMENTO: 'Em andamento',
  IMPEDIDA: 'Impedida',
  CONCLUIDA: 'Concluída',
  CANCELADA: 'Cancelada',
};

export const TAREFA_STATUS_PENDENTES: ChamadoTarefaStatus[] = ['NOVA', 'VISUALIZADA', 'EM_ANDAMENTO', 'IMPEDIDA'];

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

export type ChamadoTarefaDetalhe = ChamadoTarefaResumo & {
  historico: Array<{
    id: string;
    motivo: string | null;
    statusAnterior: string | null;
    statusNovo: string;
    createdAt: string;
    alteradoPor: { id: string; nome: string } | null;
  }>;
};

export type TarefasExecucaoResponse = {
  total: number;
  contadores: { novas: number; emAndamento: number; impedidas: number; atrasadas: number };
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
