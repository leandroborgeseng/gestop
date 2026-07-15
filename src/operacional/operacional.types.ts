import { RegiaoUnidade, UnidadeTipo } from '@prisma/client';

export type UnidadeSituacao = 'OPERACIONAL' | 'COM_PENDENCIAS' | 'SEM_LOCALIZACAO' | 'INATIVA';

export type TipoPendencia = 'CHAMADOS' | 'NAO_CONFORMIDADES' | 'VISTORIAS';

export type SlaFiltro = 'DENTRO' | 'FORA';

export type UnidadeSlaMapa = 'DENTRO' | 'FORA' | null;

export type UnidadeListQuery = {
  search?: string;
  secretariaId?: string;
  tipo?: UnidadeTipo;
  situacao?: UnidadeSituacao;
  pendencias?: boolean;
  bairro?: string;
  regiao?: RegiaoUnidade;
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
  tipo: UnidadeTipo;
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
    chamadosAbertos: number;
    semVistoria: boolean;
    /** Detalhe da vistoria programada mais antiga em atraso (quando semVistoria). */
    vistoriaAtrasada?: VistoriaAtrasadaResumo | null;
  };
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
