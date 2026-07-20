export type UnidadeTipo =
  | 'ESCOLA'
  | 'UBS'
  | 'PRACA'
  | 'PREDIO_ADMINISTRATIVO'
  | 'ESPACO_ESPORTIVO'
  | 'OUTRO';

export type UnidadeSituacao = 'OPERACIONAL' | 'COM_PENDENCIAS' | 'SEM_LOCALIZACAO' | 'INATIVA';

export type TipoPendencia = 'CHAMADOS' | 'NAO_CONFORMIDADES' | 'VISTORIAS';

export type SlaFiltro = 'DENTRO' | 'FORA';

export type UnidadeSlaMapa = 'DENTRO' | 'FORA' | null;

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
  /** Próprios com vistoria programada atrasada no cronograma. */
  vistoriasAtrasadas?: number;
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
  regiao?: import('./regiao-unidade').RegiaoUnidade | null;
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
    /** True quando há vistoria programada no cronograma com data prevista vencida. */
    semVistoria?: boolean;
    vistoriaAtrasada?: {
      proximaChecagemEm: string;
      checklistNome: string;
    } | null;
  };
  totais: {
    fiscalizacoes: number;
    naoConformidadesAbertas: number;
    chamadosAbertos: number;
    chamadosSlaForaPrazo?: number;
    semVistoria?: boolean;
  };
  slaMapa?: UnidadeSlaMapa;
  ultimaVistoriaNota?: VistoriaNotaResumo | null;
};

export type VistoriaNotaResumo = {
  notaGeral: number | null;
  notasPorCategoria: Array<{
    categoriaId: string;
    categoriaNome: string;
    nota: number;
  }>;
  fiscalizacaoId?: string;
  concluidaEm?: string | null;
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
      tipoChamado?: { id: string; nome: string } | null;
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
  regiao?: string;
  responsavel?: string;
  responsavelEmail?: string;
  tiposPendencia?: TipoPendencia[];
  tiposChamadoId?: string[];
  equipeIds?: string[];
  sla?: SlaFiltro;
};

export type CategoriaVistoriaOption = {
  id: string;
  nome: string;
};

export type UnidadeFiltroOpcoes = {
  secretarias: SecretariaOption[];
  bairros: string[];
  tipos: UnidadeTipo[];
  regioes?: import('./regiao-unidade').RegiaoUnidade[];
  categoriasVistoria?: CategoriaVistoriaOption[];
  responsaveis: Array<{
    nome: string;
    email: string | null;
    secretariaId: string;
    secretariaSigla: string;
  }>;
  emails: string[];
  equipes?: Array<{ id: string; nome: string; codigo?: string | null }>;
  tiposChamado?: Array<{ id: string; nome: string }>;
};

export type ChamadosMapaFilters = {
  search?: string;
  status?: string[];
  prioridade?: string[];
  tipoChamadoId?: string[];
  equipeIds?: string[];
  sla?: SlaFiltro;
  bairro?: string;
  comUnidade?: 'TODOS' | 'COM' | 'SEM';
};

export type ChamadoMapaItem = {
  id: string;
  codigo: string;
  titulo: string | null;
  descricao: string;
  status: string;
  prioridade: string;
  origem: string;
  prazoEm: string | null;
  previstaExecucaoEm: string | null;
  enderecoTexto: string | null;
  enderecoBairro: string | null;
  latitude: number | null;
  longitude: number | null;
  mapaLatitude: number | null;
  mapaLongitude: number | null;
  slaMapa: UnidadeSlaMapa;
  createdAt: string;
  secretaria: SecretariaOption;
  unidade: {
    id: string;
    nome: string;
    codigoPatrimonial: string;
    endereco: string;
    bairro: string | null;
    latitude: number | null;
    longitude: number | null;
  } | null;
  equipe: { id: string; nome: string } | null;
  tipoChamado: { id: string; nome: string } | null;
  responsavel: { id: string; nome: string } | null;
};

export type AuthUserPerfilResumo = {
  id: string;
  nome: string;
};

export type AuthUserSecretariaResumo = {
  id: string;
  nome: string;
  sigla: string;
  principal?: boolean;
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
  perfilAtivo?: AuthUserPerfilResumo | null;
  perfisDisponiveis?: AuthUserPerfilResumo[];
  secretariaAtiva?: AuthUserSecretariaResumo | null;
  secretariasDisponiveis?: AuthUserSecretariaResumo[];
  acessoTodasSecretarias?: boolean;
  secretariaEscopoTodas?: boolean;
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
  regiao?: import('./regiao-unidade').RegiaoUnidade | null;
  latitude: number | string;
  longitude: number | string;
  raioValidacaoMetros: number;
  ativo: boolean;
  metadata?: UnidadeMetadata | null;
  secretaria: SecretariaOption;
};

export type AdminCategoriaVistoria = {
  id: string;
  nome: string;
  ativo: boolean;
};

export type UnidadeManualOverride = {
  lockedFields: string[];
  editedAt: string;
  editedBy?: string;
  reason?: string;
  deactivatedManually?: boolean;
};

export type UnidadeWebmapSource = {
  repo?: string;
  layerFile?: string;
  group?: string;
  githubCommitSha?: string;
  importedAt?: string;
};

export type UnidadeMetadata = {
  webmapSource?: UnidadeWebmapSource;
  manualOverride?: UnidadeManualOverride;
};

export type AdminPerfil = {
  id: string;
  nome: string;
  descricao?: string | null;
  sistema?: boolean;
  ativo?: boolean;
  permissoes?: AdminPermissao[];
};

export type AdminPermissao = {
  id: string;
  codigo: string;
  descricao?: string | null;
  modulo: string;
};

export type AdminUsuario = {
  id: string;
  secretariaId?: string | null;
  acessoTodasSecretarias?: boolean;
  nome: string;
  email: string;
  cpf?: string | null;
  telefone?: string | null;
  cargo?: string | null;
  cargoId?: string | null;
  cargoRef?: { id: string; nome: string; ativo: boolean } | null;
  ativo: boolean;
  secretaria?: SecretariaOption | null;
  secretariasVinculos?: Array<{
    principal: boolean;
    secretaria: SecretariaOption;
  }>;
  perfis: Array<{
    perfil: AdminPerfil;
  }>;
  equipes?: Array<{
    equipe: { id: string; nome: string; ativo: boolean };
  }>;
};

export type AdminEquipe = {
  id: string;
  codigo: string;
  nome: string;
  descricao?: string | null;
  tipo?: 'PROPRIA' | 'TERCEIRIZADA';
  emailEquipe?: string | null;
  ativo: boolean;
  secretariaId?: string | null;
  secretaria?: SecretariaOption | null;
  membros: Array<{
    usuario: { id: string; nome: string; email: string; ativo: boolean };
  }>;
  _count?: { chamados: number };
};

export type AdminCargo = {
  id: string;
  nome: string;
  ativo: boolean;
};

export type AdminTipoChamado = {
  id: string;
  nome: string;
  descricao?: string | null;
  slaBaixaDias: number;
  slaMediaDias: number;
  slaAltaDias: number;
  slaUrgenteDias: number;
  exigeVistoriaPrevia: boolean;
  ativo: boolean;
};

export type TipoChamadoOpcao = {
  id: string;
  nome: string;
};

export type EquipeOpcaoResumo = {
  id: string;
  codigo?: string;
  nome: string;
  secretaria?: SecretariaOption | null;
};

export type EquipeOpcao = EquipeOpcaoResumo & {
  membros: Array<{
    usuario: { id: string; nome: string; ativo: boolean };
  }>;
};

export type UsuarioExecucaoOpcao = {
  id: string;
  nome: string;
  email: string;
  cpf: string | null;
  cargo: string | null;
  cargoRef?: { id: string; nome: string } | null;
  secretaria?: SecretariaOption | null;
};

export type ExecucaoParticipanteResumo = {
  id: string;
  nome: string;
  email?: string;
  cargo?: string | null;
  secretaria?: { id: string; nome: string; sigla: string } | null;
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
  unitChanges?: WebmapUnitChange[];
  unchangedCount?: number;
  blockedCount?: number;
};

export type WebmapUnitChangeAction = 'CREATE' | 'UPDATE' | 'SKIP' | 'DEACTIVATE' | 'UNCHANGED';

export type WebmapFieldChange = {
  field: string;
  label: string;
  before: string | null;
  after: string | null;
  willApply: boolean;
  skipReason?: 'MANUAL_LOCK' | 'NOT_SELECTED' | 'UNCHANGED';
};

export type WebmapUnitChange = {
  codigoPatrimonial: string;
  nome: string;
  action: WebmapUnitChangeAction;
  skipReason?: string;
  changes?: WebmapFieldChange[];
};

export type WebmapImportSelection = {
  codigoPatrimonial: string;
  apply: boolean;
  fields?: string[];
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
export type ChecklistFinalidade = 'VISTORIA' | 'CHAMADO';
export type ChecklistVersaoStatus = 'RASCUNHO' | 'PUBLICADA' | 'ARQUIVADA';
export type ChecklistItemTipo = 'TEXTO' | 'NUMERO' | 'BOOLEANO' | 'MULTIPLA_ESCOLHA' | 'ESCALA_LIKERT' | 'FOTO' | 'ASSINATURA' | 'DATA';

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
  categoriaVistoriaId?: string | null;
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
  finalidade?: ChecklistFinalidade;
  escopo: ChecklistEscopo;
  unidadeTipo?: UnidadeTipo | null;
  ativo: boolean;
  secretaria?: SecretariaOption | null;
  tiposChamado?: Array<{ tipoChamado: { id: string; nome: string; ativo?: boolean } }>;
  versoes: ChecklistVersao[];
};

export type MobileFieldPackage = {
  downloadedAt: string;
  secretariaEscopo?: {
    ativaId: string | null;
    todas: boolean;
  };
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
    valorBooleano?: boolean | null;
    valorTexto?: string;
    valorNumero?: number;
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
  | 'EM_AVALIACAO_TECNICA'
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

export type ChamadosListResponse = {
  items: ChamadoResumo[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
};

export type ChamadoProtocoloPublico = {
  codigo: string;
  status: ChamadoStatus;
  prioridade: string;
  descricaoResumo: string;
  local: string | null;
  bairro: string | null;
  secretaria: string | null;
  abertoEm: string;
  encerradoEm: string | null;
  historico: Array<{ status: string; motivo: string | null; em: string }>;
};

export type ChamadoProgramacaoDia = {
  data: string;
  chamados: ChamadoResumo[];
};

export type ChamadoProgramacaoResponse = {
  from: string;
  to: string;
  equipeId: string | null;
  totalProgramados: number;
  totalPendentes: number;
  pendentesTruncados: boolean;
  pendentes: ChamadoResumo[];
  porDia: ChamadoProgramacaoDia[];
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

export type ChamadoModoLocalizacao = 'UNIDADE' | 'GEOLOCALIZACAO' | 'ENDERECO';

export type ChamadoResumo = {
  id: string;
  codigo: string;
  titulo?: string | null;
  descricao: string;
  status: ChamadoStatus;
  origem: ChamadoOrigem;
  prioridade: string;
  modoLocalizacao?: ChamadoModoLocalizacao;
  enderecoTexto?: string | null;
  enderecoBairro?: string | null;
  prazoEm?: string | null;
  previstaExecucaoEm?: string | null;
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
  unidade?: {
    id: string;
    nome: string;
    codigoPatrimonial: string;
    endereco?: string;
    bairro?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    raioValidacaoMetros?: number;
    /** Secretaria cadastral do próprio (quando o chamado está vinculado a uma unidade). */
    secretaria?: SecretariaOption | null;
  } | null;
  responsavel?: { id: string; nome: string } | null;
  equipe?: { id: string; nome: string } | null;
  tipoChamado?: { id: string; nome: string; exigeVistoriaPrevia?: boolean } | null;
  naoConformidade?: ChamadoNaoConformidade | null;
  registradoPor?: { id: string; nome: string } | null;
};

export type ChamadoDetalhe = ChamadoResumo & {
  historico: Array<{
    id: string;
    statusAnterior?: string | null;
    statusNovo: string;
    motivo?: string | null;
    metadata?: Record<string, unknown> | null;
    createdAt: string;
    alteradoPor?: { id: string; nome: string } | null;
    anexos?: Array<{ id: string; url: string; mimeType?: string | null; descricao?: string | null }>;
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
  checklistComplementar?: {
    checklistId: string;
    checklistNome: string;
    checklistVersaoId: string;
    versao: number;
    itens: Array<{
      id: string;
      ordem: number;
      codigo: string;
      titulo: string;
      tipo: string;
      obrigatorio: boolean;
      exigeEvidencia: boolean;
      opcoes?: unknown;
    }>;
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
  previstaExecucaoEm?: string | null;
  prazoEm?: string | null;
  programado?: boolean;
  meta?: string;
  label?: string;
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

export type DashboardRankingItem = {
  chave: string;
  label: string;
  detalhe?: string | null;
  total: number;
};

export type DashboardData = {
  filtrosAplicados?: {
    from: string | null;
    to: string | null;
    secretariaId: string | null;
    equipeId: string | null;
    cargo: string | null;
    tipoChamadoId: string | null;
    prioridade: string | null;
    status: string | null;
  };
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
  analise?: {
    produtividadePorFuncionario: DashboardRankingItem[];
    produtividadePorEquipe: DashboardRankingItem[];
    produtividadePorCargo: DashboardRankingItem[];
    chamadosPorTipo: DashboardRankingItem[];
    chamadosPorSecretaria: DashboardRankingItem[];
    totalConcluidosAnalisados: number;
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

export type FiscalizacaoStatus =
  | 'PLANEJADA'
  | 'EM_ANDAMENTO'
  | 'CONCLUIDA'
  | 'CANCELADA'
  | 'SINCRONIZACAO_PENDENTE';

export type FiscalizacaoResumo = {
  id: string;
  status: FiscalizacaoStatus;
  origem: string;
  iniciadaEm: string | null;
  concluidaEm: string | null;
  dentroRaioPermitido: boolean | null;
  distanciaCheckinMetros: number | null;
  observacoes?: string | null;
  createdAt: string;
  secretaria: { id: string; sigla: string; nome: string };
  unidade: { id: string; nome: string; codigoPatrimonial: string; bairro?: string | null; tipo?: UnidadeTipo };
  agente: { id: string; nome: string };
  checklistVersao: {
    id: string;
    versao: number;
    checklist: { id: string; nome: string };
  };
  nota?: VistoriaNotaResumo | null;
};

export type FiscalizacaoDetalhe = FiscalizacaoResumo & {
  respostas?: Array<{
    id: string;
    conformidade: string | null;
    valorTexto: string | null;
    valorNumero: number | null;
    valorBooleano: boolean | null;
    comentario: string | null;
    respondidoEm: string;
    item: {
      id: string;
      codigo: string;
      titulo: string;
      tipo: string;
      categoriaVistoriaId?: string | null;
      categoriaVistoria?: { id: string; nome: string } | null;
    };
    naoConformidade?: {
      id: string;
      chamado?: { id: string; codigo: string } | null;
    } | null;
    evidencias?: Array<{
      id: string;
      tipo: string;
      url: string;
      mimeType?: string | null;
      capturadaEm: string;
    }>;
  }>;
  evidencias?: Array<{
    id: string;
    tipo: string;
    url: string;
    mimeType?: string | null;
    capturadaEm: string;
    descricao?: string | null;
    respostaId?: string | null;
  }>;
  naoConformidades?: Array<{
    id: string;
    descricao: string;
    severidade: string;
    status: string;
    item: { codigo: string; titulo: string };
  }>;
};

export type FiscalizacoesListResponse = {
  items: FiscalizacaoResumo[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
};
