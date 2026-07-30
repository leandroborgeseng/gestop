import { RegiaoUnidade } from '@prisma/client';

export type UnidadeSituacao = 'OPERACIONAL' | 'COM_PENDENCIAS' | 'SEM_LOCALIZACAO' | 'INATIVA';

export type TipoPendencia = 'CHAMADOS' | 'NAO_CONFORMIDADES' | 'VISTORIAS';

export type SlaFiltro = 'DENTRO' | 'FORA';

export type UnidadeSlaMapa = 'DENTRO' | 'FORA' | null;

export type UnidadeListQuery = {
  search?: string;
  /** @deprecated use secretariaIds */
  secretariaId?: string;
  secretariaIds?: string[];
  /** @deprecated use tipos — codigo do TipoProprio */
  tipo?: string;
  /** Codigos do catalogo TipoProprio */
  tipos?: string[];
  situacao?: UnidadeSituacao;
  pendencias?: boolean;
  /** @deprecated use bairros */
  bairro?: string;
  bairros?: string[];
  /** @deprecated use regioes */
  regiao?: RegiaoUnidade;
  regioes?: RegiaoUnidade[];
  responsavel?: string;
  responsavelEmail?: string;
  /** Quando informado, redefine o que conta como pendência (default legado: CH + NC). */
  tiposPendencia?: TipoPendencia[];
  /** Só aplica quando CHAMADOS está entre os tipos de pendência ativos. */
  tiposChamadoId?: string[];
  /** Filtra próprios que tenham chamado aberto atribuído a estas equipes. */
  equipeIds?: string[];
  /** Filtra próprios conforme SLA dos chamados abertos relevantes. */
  sla?: SlaFiltro;
};

export type VistoriaAtrasadaResumo = {
  proximaChecagemEm: string;
  checklistNome: string;
};

export type UnidadeResumoCounts = {
  fiscalizacoes: number;
  naoConformidadesAbertas: number;
  chamadosAbertos: number;
  chamadosSlaForaPrazo: number;
  /** True quando há cronograma ativo com próxima checagem vencida (não realizada). */
  semVistoria: boolean;
};

export type UnidadeVistoriaNotaResumo = {
  notaGeral: number | null;
  notasPorCategoria: Array<{
    categoriaId: string;
    categoriaNome: string;
    nota: number;
  }>;
  fiscalizacaoId?: string;
  concluidaEm?: string | null;
};

export type UnidadeOperacional = {
  id: string;
  codigoPatrimonial: string;
  nome: string;
  /** Codigo do TipoProprio */
  tipo: string;
  endereco: string;
  bairro: string | null;
  cep: string | null;
  regiao: RegiaoUnidade | null;
  latitude: number | null;
  longitude: number | null;
  raioValidacaoMetros: number;
  ativo: boolean;
  situacao: UnidadeSituacao;
  secretaria: {
    id: string;
    nome: string;
    sigla: string;
    responsavelNome?: string | null;
    responsavelEmail?: string | null;
  };
  pendencias: {
    naoConformidadesAbertas: number;
    /** NCs abertas/em triagem ainda sem chamado — evita duplicar com chamadosAbertos. */
    naoConformidadesSemChamadoAberto: number;
    chamadosAbertos: number;
    semVistoria: boolean;
    /** Detalhe da vistoria programada mais antiga em atraso (quando semVistoria). */
    vistoriaAtrasada?: VistoriaAtrasadaResumo | null;
  };
  /**
   * Itens únicos de pendência neste próprio (respeitando tiposPendencia).
   * Não inclui classificação SLA.
   */
  pendenciasUnicas: number;
  totais: UnidadeResumoCounts;
  /** Verde/vermelho no mapa quando há chamado aberto com prazo. */
  slaMapa: UnidadeSlaMapa;
  ultimaVistoriaNota?: UnidadeVistoriaNotaResumo | null;
};

export type ChamadosMapaQuery = {
  search?: string;
  status?: string[];
  prioridade?: string[];
  tipoChamadoId?: string[];
  equipeIds?: string[];
  sla?: SlaFiltro;
  /** @deprecated use bairros */
  bairro?: string;
  bairros?: string[];
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
  secretaria: { id: string; nome: string; sigla: string };
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
