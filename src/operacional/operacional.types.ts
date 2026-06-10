import { UnidadeTipo } from '@prisma/client';

export type UnidadeSituacao = 'OPERACIONAL' | 'COM_PENDENCIAS' | 'SEM_LOCALIZACAO' | 'INATIVA';

export type UnidadeListQuery = {
  search?: string;
  secretariaId?: string;
  tipo?: UnidadeTipo;
  situacao?: UnidadeSituacao;
  pendencias?: boolean;
  bairro?: string;
  responsavel?: string;
  responsavelEmail?: string;
};

export type UnidadeResumoCounts = {
  fiscalizacoes: number;
  naoConformidadesAbertas: number;
  chamadosAbertos: number;
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
  };
  totais: UnidadeResumoCounts;
};
