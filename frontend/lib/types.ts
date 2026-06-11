export type UnidadeTipo =
  | 'ESCOLA'
  | 'UBS'
  | 'PRACA'
  | 'PREDIO_ADMINISTRATIVO'
  | 'ESPACO_ESPORTIVO'
  | 'OUTRO';

export type UnidadeSituacao = 'OPERACIONAL' | 'COM_PENDENCIAS' | 'SEM_LOCALIZACAO' | 'INATIVA';

export type SecretariaOption = {
  id: string;
  nome: string;
  sigla: string;
};

export type OperacionalResumo = {
  totalUnidades: number;
  unidadesAtivas: number;
  totalSecretarias: number;
  fiscalizacoesConcluidas: number;
  naoConformidadesAbertas: number;
  chamadosAbertos: number;
  eventosSyncPendentes: number;
};

export type UnidadeOperacional = {
  id: string;
  codigoPatrimonial: string;
  nome: string;
  tipo: UnidadeTipo;
  endereco: string;
  bairro: string | null;
  cep: string | null;
  latitude: number | null;
  longitude: number | null;
  raioValidacaoMetros: number;
  ativo: boolean;
  situacao: UnidadeSituacao;
  secretaria: SecretariaOption & {
    responsavelNome?: string | null;
    responsavelEmail?: string | null;
  };
  pendencias: {
    naoConformidadesAbertas: number;
    chamadosAbertos: number;
  };
  totais: {
    fiscalizacoes: number;
    naoConformidadesAbertas: number;
    chamadosAbertos: number;
  };
};

export type UnidadeDetalhe = UnidadeOperacional & {
  ultimasFiscalizacoes: Array<{
    id: string;
    status: string;
    origem: string;
    iniciadaEm: string | null;
    concluidaEm: string | null;
    dentroRaioPermitido: boolean | null;
    distanciaCheckinMetros: number | null;
    agente: {
      id: string;
      nome: string;
    };
    checklistVersao: {
      id: string;
      versao: number;
      checklist: {
        id: string;
        nome: string;
      };
    };
  }>;
  pendenciasDetalhadas: {
    naoConformidades: Array<{
      id: string;
      descricao: string;
      severidade: string;
      status: string;
      registradaEm: string;
      item: {
        codigo: string;
        titulo: string;
      };
    }>;
    chamados: Array<{
      id: string;
      codigo: string;
      titulo: string | null;
      descricao: string;
      prioridade: string;
      status: string;
      createdAt: string;
      prazoEm: string | null;
      responsavel: {
        id: string;
        nome: string;
      } | null;
    }>;
  };
};

export type UnidadeFilters = {
  search?: string;
  secretariaId?: string;
  tipo?: string;
  situacao?: string;
  pendencias?: string;
  bairro?: string;
  responsavel?: string;
  responsavelEmail?: string;
};

export type UnidadeFiltroOpcoes = {
  secretarias: SecretariaOption[];
  bairros: string[];
  tipos: UnidadeTipo[];
  responsaveis: Array<{
    nome: string;
    email: string | null;
    secretariaId: string;
    secretariaSigla: string;
  }>;
  emails: string[];
};

export type AuthUser = {
  id: string;
  nome: string;
  email: string;
  perfis: string[];
  permissoes: string[];
  secretaria?: {
    id: string;
    nome: string;
    sigla: string;
  } | null;
};

export type LoginResponse = {
  accessToken: string;
  tokenType: 'Bearer';
  expiresInSeconds: number;
  user: AuthUser;
};

export type AdminSecretaria = {
  id: string;
  nome: string;
  sigla: string;
  descricao?: string | null;
  responsavelNome?: string | null;
  responsavelEmail?: string | null;
  ativo: boolean;
};

export type AdminUnidade = {
  id: string;
  secretariaId: string;
  codigoPatrimonial: string;
  nome: string;
  tipo: UnidadeTipo;
  endereco: string;
  bairro?: string | null;
  cep?: string | null;
  latitude: number | string;
  longitude: number | string;
  raioValidacaoMetros: number;
  ativo: boolean;
  secretaria: SecretariaOption;
};

export type AdminPerfil = {
  id: string;
  nome: string;
  descricao?: string | null;
};

export type AdminUsuario = {
  id: string;
  secretariaId?: string | null;
  nome: string;
  email: string;
  cpf?: string | null;
  telefone?: string | null;
  cargo?: string | null;
  ativo: boolean;
  secretaria?: SecretariaOption | null;
  perfis: Array<{
    perfil: AdminPerfil;
  }>;
  equipes?: Array<{
    equipe: { id: string; nome: string; ativo: boolean };
  }>;
};

export type AdminEquipe = {
  id: string;
  nome: string;
  descricao?: string | null;
  ativo: boolean;
  secretariaId?: string | null;
  secretaria?: SecretariaOption | null;
  membros: Array<{
    usuario: { id: string; nome: string; email: string; ativo: boolean };
  }>;
  _count?: { chamados: number };
};

export type EquipeOpcao = {
  id: string;
  nome: string;
  secretaria?: SecretariaOption | null;
  membros: Array<{
    usuario: { id: string; nome: string; ativo: boolean };
  }>;
};

export type WebmapImportGithub = {
  repo: string;
  branch: string;
  commitSha: string;
  commitMessage: string;
  committedAt: string;
  htmlUrl: string;
};

export type WebmapSkipReason = 'SECRETARIA_NAO_CADASTRADA' | 'SECRETARIA_NAO_RESOLVIDA';
export type WebmapRejectReason = 'SEM_COORDENADAS' | 'SEM_NOME' | 'FORA_MUNICIPIO' | 'CADASTRO_INVALIDO';

export type WebmapImportDiff = {
  previousCommitSha: string | null;
  createdCodigos: string[];
  updatedCodigos: string[];
  deactivatedCodigos: string[];
};

export type WebmapSkippedUnit = {
  reason: WebmapSkipReason;
  codigoPatrimonial: string;
  nome: string;
  secretariaSigla: string;
  layerFile: string;
  layerGroup: string;
  endereco: string;
  bairro: string | null;
  unidadeMunicipal: string | null;
  latitude: number;
  longitude: number;
  sugestao: string;
};

export type WebmapRejectedFeature = {
  reason: WebmapRejectReason;
  layerFile: string;
  layerGroup: string;
  fid: string;
  nomeParcial: string | null;
  unidadeMunicipal: string | null;
  cadastroImobiliario: string | null;
  sugestao: string;
};

export type WebmapImportLastSync = {
  id?: string | null;
  syncedAt: string;
  githubCommitSha: string;
  usuario: { nome: string; email: string };
  created: number | null;
  updated: number | null;
  uniqueUnits: number | null;
  skipped: number | null;
  deactivated?: number | null;
  skippedUnits: WebmapSkippedUnit[];
  rejectedFeatures: WebmapRejectedFeature[];
  deactivatedUnits?: Array<{ codigoPatrimonial: string; nome: string }>;
  diff?: WebmapImportDiff | null;
  layersFailed: number | null;
  layersDiscovered?: number | null;
  durationMs?: number | null;
  triggeredBy?: string;
  importResult?: WebmapImportResult | null;
};

export type WebmapImportStatus = {
  github: WebmapImportGithub;
  lastSync: WebmapImportLastSync | null;
  unidadesCount: number;
  hasUpdates: boolean;
  layersConfigured: number;
  repoUrl: string;
  automation?: { cronEnabled: boolean; webhookEnabled: boolean };
};

export type WebmapImportResult = {
  dryRun: boolean;
  triggeredBy?: 'manual' | 'cron' | 'webhook';
  durationMs?: number;
  featuresRead: number;
  uniqueUnits: number;
  created: number;
  updated: number;
  skipped: number;
  deactivated?: number;
  skippedUnits: WebmapSkippedUnit[];
  rejectedFeatures: WebmapRejectedFeature[];
  deactivatedUnits?: Array<{ codigoPatrimonial: string; nome: string }>;
  secretariasCadastradas: string[];
  layersProcessed: number;
  layersFailed: number;
  layersDiscovered?: number;
  autoDiscoveredLayers?: string[];
  totalUnidadesInDb: number;
  diff?: WebmapImportDiff;
  github: WebmapImportGithub;
};

export type WebmapSyncAllResult = {
  secretarias: { created: number; updated: number; total: number; dryRun: boolean };
  webmap: WebmapImportResult;
};

export type ChecklistEscopo = 'GLOBAL' | 'SECRETARIA' | 'UNIDADE_TIPO' | 'UNIDADE';
export type ChecklistVersaoStatus = 'RASCUNHO' | 'PUBLICADA' | 'ARQUIVADA';
export type ChecklistItemTipo = 'TEXTO' | 'NUMERO' | 'BOOLEANO' | 'MULTIPLA_ESCOLHA' | 'FOTO' | 'ASSINATURA' | 'DATA';

export type ChecklistItem = {
  id: string;
  ordem: number;
  codigo: string;
  titulo: string;
  descricao?: string | null;
  tipo: ChecklistItemTipo;
  obrigatorio: boolean;
  geraNaoConformidade: boolean;
  exigeEvidencia: boolean;
  opcoes?: unknown;
  ativo: boolean;
};

export type ChecklistVersao = {
  id: string;
  versao: number;
  status: ChecklistVersaoStatus;
  publicadoAt?: string | null;
  itens: ChecklistItem[];
};

export type ChecklistModel = {
  id: string;
  secretariaId?: string | null;
  nome: string;
  descricao?: string | null;
  escopo: ChecklistEscopo;
  unidadeTipo?: UnidadeTipo | null;
  ativo: boolean;
  secretaria?: SecretariaOption | null;
  versoes: ChecklistVersao[];
};

export type MobileFieldPackage = {
  downloadedAt: string;
  unidades: Array<{
    id: string;
    nome: string;
    codigoPatrimonial: string;
    tipo: UnidadeTipo;
    endereco: string;
    bairro?: string | null;
    latitude: number;
    longitude: number;
    raioValidacaoMetros: number;
    secretaria: SecretariaOption;
  }>;
  checklists: ChecklistModel[];
};

export type MobileQueuedInspection = {
  clientEventId: string;
  deviceId: string;
  unidadeId: string;
  checklistVersaoId: string;
  iniciadaEm: string;
  concluidaEm: string;
  checkin: {
    latitude: number;
    longitude: number;
    precisaoMetros: number;
  };
  respostas: Array<{
    itemId: string;
    conformidade: 'CONFORME' | 'NAO_CONFORME' | 'NAO_APLICAVEL';
    valorBooleano?: boolean;
    valorTexto?: string;
    comentario?: string;
    evidencias: Array<{
      tipo: 'FOTO';
      url: string;
      mimeType?: string;
      tamanhoBytes?: number;
      capturadaEm: string;
      localizacao: {
        latitude: number;
        longitude: number;
        precisaoMetros: number;
      };
    }>;
  }>;
};

export type ChamadoStatus =
  | 'ABERTO'
  | 'EM_TRIAGEM'
  | 'EM_ATENDIMENTO'
  | 'EM_EXECUCAO'
  | 'IMPEDIDO'
  | 'CONCLUIDO'
  | 'CANCELADO';

export type ChamadosEmExecucaoGrupo = {
  equipe: { id: string; nome: string; secretaria?: { sigla: string } | null } | null;
  chamados: ChamadoResumo[];
};

export type ChamadosEmExecucaoResponse = {
  total: number;
  grupos: ChamadosEmExecucaoGrupo[];
};

export type ChamadoOrigem = 'MANUAL' | 'QR_CODE' | 'INTERNO' | 'FISCALIZACAO';

export type ChamadoNaoConformidade = {
  id: string;
  descricao: string;
  severidade: string;
  status: string;
  item: {
    codigo: string;
    titulo: string;
  };
};

export type ChamadoResumo = {
  id: string;
  codigo: string;
  titulo?: string | null;
  descricao: string;
  status: ChamadoStatus;
  origem: ChamadoOrigem;
  prioridade: string;
  prazoEm?: string | null;
  concluidoEm?: string | null;
  impedimentoMotivo?: string | null;
  solicitanteNome?: string | null;
  solicitanteEmail?: string | null;
  solicitanteTelefone?: string | null;
  fotoUrl?: string | null;
  fotoMimeType?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  createdAt: string;
  encerradoEm?: string | null;
  secretaria: SecretariaOption;
  unidade: {
    id: string;
    nome: string;
    codigoPatrimonial: string;
    endereco?: string;
    bairro?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    raioValidacaoMetros?: number;
  };
  responsavel?: { id: string; nome: string } | null;
  equipe?: { id: string; nome: string } | null;
  naoConformidade?: ChamadoNaoConformidade | null;
  registradoPor?: { id: string; nome: string } | null;
};

export type ChamadoDetalhe = ChamadoResumo & {
  historico: Array<{
    id: string;
    statusAnterior?: string | null;
    statusNovo: string;
    motivo?: string | null;
    createdAt: string;
    alteradoPor?: { id: string; nome: string } | null;
  }>;
};

export type ChamadoEvidencia = {
  id: string;
  tipo: string;
  url: string;
  mimeType?: string | null;
  tamanhoBytes?: number | null;
  latitude?: number | null;
  longitude?: number | null;
  precisaoMetros?: number | null;
  capturadaEm: string;
  descricao?: string | null;
};

export type ChamadoExecucaoCheckin = {
  latitude: number;
  longitude: number;
  precisaoMetros?: number | null;
  distanciaMetros?: number | null;
  raioMetros?: number | null;
  createdAt: string;
};

export type ChamadoExecucaoDetalhe = ChamadoDetalhe & {
  evidencias: ChamadoEvidencia[];
  execucaoCheckin: ChamadoExecucaoCheckin | null;
  unidadeExecucao: {
    latitude: number;
    longitude: number;
    raioValidacaoMetros: number;
    endereco: string;
    bairro?: string | null;
  } | null;
};

export type ChamadoMapPoint = {
  id: string;
  codigo: string;
  titulo: string;
  latitude: number;
  longitude: number;
  unidadeNome: string;
  prioridade: string;
  equipeNome?: string | null;
};

export type PublicUnidadeChamado = {
  id: string;
  codigoPatrimonial: string;
  nome: string;
  tipo: UnidadeTipo;
  endereco: string;
  bairro?: string | null;
  latitude: number;
  longitude: number;
  secretaria: SecretariaOption;
};

export type DashboardData = {
  indicadores: {
    totalUnidades: number;
    fiscalizacoes: number;
    naoConformidades: number;
    chamados: {
      abertos: number;
      emAtendimento: number;
      emExecucao: number;
      impedidos: number;
      concluidos: number;
    };
    syncPendentes: number;
  };
  pendenciasPorSecretaria: Array<{
    id: string;
    sigla: string;
    nome: string;
    chamadosPendentes: number;
    fiscalizacoes: number;
  }>;
};

export type AlertasOperacionais = {
  resumo: {
    chamadosAtrasados: number;
    chamadosSemTriagem: number;
    syncFalhas: number;
    chamadosUrgentes: number;
  };
  chamadosAtrasados: Array<{
    id: string;
    codigo: string;
    titulo: string | null;
    descricao: string;
    prioridade: string;
    status: string;
    prazoEm: string;
    secretaria: { sigla: string };
    unidade: { nome: string };
  }>;
  chamadosSemTriagem: Array<{
    id: string;
    codigo: string;
    status: string;
    origem: string;
    createdAt: string;
    secretaria: { sigla: string };
    unidade: { nome: string };
  }>;
};

export type AuditoriaEvento = {
  id: string;
  acao: string;
  entidadeTipo: string;
  entidadeId?: string | null;
  createdAt: string;
  usuario?: {
    id: string;
    nome: string;
    email: string;
  } | null;
};

export type IntegracoesEventos = {
  syncFalhas: Array<{
    id: string;
    clientEventId: string;
    deviceId: string;
    status: string;
    conflitoMotivo?: string | null;
    tentativas: number;
    recebidoEm: string;
  }>;
  auditoriaIntegracoes: AuditoriaEvento[];
};

export type CronogramaFrequencia =
  | 'SEMANAL'
  | 'QUINZENAL'
  | 'MENSAL'
  | 'BIMESTRAL'
  | 'TRIMESTRAL'
  | 'SEMESTRAL'
  | 'ANUAL';

export type CronogramaChecagem = {
  id: string;
  unidadeId: string;
  checklistId: string;
  frequencia: CronogramaFrequencia;
  proximaChecagemEm: string;
  ultimaChecagemEm?: string | null;
  responsavelId?: string | null;
  ativo: boolean;
  observacoes?: string | null;
  unidade: {
    id: string;
    nome: string;
    tipo: UnidadeTipo;
    secretaria: SecretariaOption;
  };
  checklist: {
    id: string;
    nome: string;
    escopo: ChecklistEscopo;
    unidadeTipo?: UnidadeTipo | null;
  };
  responsavel?: {
    id: string;
    nome: string;
    email: string;
  } | null;
};

export type CalendarioChecagemEvento = {
  id: string;
  tipo: 'AGENDADA' | 'REALIZADA' | 'ATRASADA';
  data: string;
  unidade: {
    id: string;
    nome: string;
    secretariaSigla: string;
  };
  checklist: {
    id: string;
    nome: string;
  };
  cronogramaId?: string;
  fiscalizacaoId?: string;
  frequencia?: CronogramaFrequencia;
  responsavelNome?: string | null;
  agenteNome?: string;
};

export type CalendarioChecagemResponse = {
  from: string;
  to: string;
  resumo: {
    total: number;
    agendadas: number;
    realizadas: number;
    atrasadas: number;
  };
  eventos: CalendarioChecagemEvento[];
};
