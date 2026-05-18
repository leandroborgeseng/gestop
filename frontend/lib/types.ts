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
  ordensServicoAbertas: number;
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
    ordensServicoAbertas: number;
  };
  totais: {
    fiscalizacoes: number;
    naoConformidadesAbertas: number;
    ordensServicoAbertas: number;
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
    ordensServico: Array<{
      id: string;
      codigo: string;
      titulo: string;
      prioridade: string;
      status: string;
      abertaEm: string;
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
