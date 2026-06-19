import { Prisma } from '@prisma/client';
import { UnidadeOperacional, UnidadeResumoCounts, UnidadeSituacao, UnidadeVistoriaNotaResumo } from './operacional.types';

type DecimalLike = Prisma.Decimal | number | string | null | undefined;

export type UnidadeBaseRecord = {
  id: string;
  codigoPatrimonial: string;
  nome: string;
  tipo: UnidadeOperacional['tipo'];
  endereco: string;
  bairro: string | null;
  cep: string | null;
  regiao?: UnidadeOperacional['regiao'];
  latitude: DecimalLike;
  longitude: DecimalLike;
  raioValidacaoMetros: number;
  ativo: boolean;
  secretaria: {
    id: string;
    nome: string;
    sigla: string;
    responsavelNome?: string | null;
    responsavelEmail?: string | null;
  };
};

function decimalToNumber(value: DecimalLike) {
  if (value === null || value === undefined) {
    return null;
  }

  return Number(value);
}

export function deriveUnidadeSituacao(input: {
  ativo: boolean;
  latitude: DecimalLike;
  longitude: DecimalLike;
  naoConformidadesAbertas: number;
  chamadosAbertos: number;
}): UnidadeSituacao {
  if (!input.ativo) {
    return 'INATIVA';
  }

  if (decimalToNumber(input.latitude) === null || decimalToNumber(input.longitude) === null) {
    return 'SEM_LOCALIZACAO';
  }

  if (input.naoConformidadesAbertas > 0 || input.chamadosAbertos > 0) {
    return 'COM_PENDENCIAS';
  }

  return 'OPERACIONAL';
}

export function mapUnidadeOperacional(
  unidade: UnidadeBaseRecord,
  counts: UnidadeResumoCounts,
  ultimaVistoriaNota?: UnidadeVistoriaNotaResumo | null,
): UnidadeOperacional {
  const situacao = deriveUnidadeSituacao({
    ativo: unidade.ativo,
    latitude: unidade.latitude,
    longitude: unidade.longitude,
    naoConformidadesAbertas: counts.naoConformidadesAbertas,
    chamadosAbertos: counts.chamadosAbertos,
  });

  return {
    id: unidade.id,
    codigoPatrimonial: unidade.codigoPatrimonial,
    nome: unidade.nome,
    tipo: unidade.tipo,
    endereco: unidade.endereco,
    bairro: unidade.bairro,
    cep: unidade.cep,
    regiao: unidade.regiao ?? null,
    latitude: decimalToNumber(unidade.latitude),
    longitude: decimalToNumber(unidade.longitude),
    raioValidacaoMetros: unidade.raioValidacaoMetros,
    ativo: unidade.ativo,
    situacao,
    secretaria: unidade.secretaria,
    pendencias: {
      naoConformidadesAbertas: counts.naoConformidadesAbertas,
      chamadosAbertos: counts.chamadosAbertos,
    },
    totais: counts,
    ultimaVistoriaNota: ultimaVistoriaNota ?? null,
  };
}

export function applyInMemoryUnidadeFilters<T extends UnidadeOperacional>(
  unidades: T[],
  filters: {
    situacao?: UnidadeSituacao;
    pendencias?: boolean;
  },
) {
  return unidades.filter((unidade) => {
    if (filters.situacao && unidade.situacao !== filters.situacao) {
      return false;
    }

    if (filters.pendencias !== undefined) {
      const hasPendencias =
        unidade.pendencias.naoConformidadesAbertas > 0 || unidade.pendencias.chamadosAbertos > 0;

      if (hasPendencias !== filters.pendencias) {
        return false;
      }
    }

    return true;
  });
}
