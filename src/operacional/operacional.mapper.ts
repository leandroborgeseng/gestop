import { Prisma } from '@prisma/client';
import {
  TipoPendencia,
  UnidadeOperacional,
  UnidadeResumoCounts,
  UnidadeSituacao,
  UnidadeSlaMapa,
  UnidadeVistoriaNotaResumo,
} from './operacional.types';

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

export const DEFAULT_TIPOS_PENDENCIA: TipoPendencia[] = [
  'CHAMADOS',
  'NAO_CONFORMIDADES',
  'VISTORIAS',
];

/** Comportamento legado da situação antes dos filtros por tipo de pendência. */
export const LEGACY_TIPOS_PENDENCIA: TipoPendencia[] = ['CHAMADOS', 'NAO_CONFORMIDADES'];

function decimalToNumber(value: DecimalLike) {
  if (value === null || value === undefined) {
    return null;
  }

  return Number(value);
}

export function isChamadoForaPrazo(prazoEm: Date | string | null | undefined, now = new Date()) {
  if (!prazoEm) return false;
  const prazo = prazoEm instanceof Date ? prazoEm : new Date(prazoEm);
  if (Number.isNaN(prazo.getTime())) return false;
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const deadline = new Date(prazo);
  deadline.setHours(0, 0, 0, 0);
  // Alinhado ao prazoInfo do frontend: “vence hoje” já é risco (fora do prazo).
  return deadline.getTime() <= today.getTime();
}

export function hasPendenciaAtiva(
  counts: Pick<UnidadeResumoCounts, 'chamadosAbertos' | 'naoConformidadesAbertas' | 'semVistoria'>,
  tiposPendencia: TipoPendencia[] = LEGACY_TIPOS_PENDENCIA,
) {
  const tipos = tiposPendencia.length > 0 ? tiposPendencia : LEGACY_TIPOS_PENDENCIA;

  return tipos.some((tipo) => {
    if (tipo === 'CHAMADOS') return counts.chamadosAbertos > 0;
    if (tipo === 'NAO_CONFORMIDADES') return counts.naoConformidadesAbertas > 0;
    if (tipo === 'VISTORIAS') return counts.semVistoria;
    return false;
  });
}

export function deriveUnidadeSituacao(input: {
  ativo: boolean;
  latitude: DecimalLike;
  longitude: DecimalLike;
  naoConformidadesAbertas: number;
  chamadosAbertos: number;
  semVistoria?: boolean;
  tiposPendencia?: TipoPendencia[];
}): UnidadeSituacao {
  if (!input.ativo) {
    return 'INATIVA';
  }

  if (decimalToNumber(input.latitude) === null || decimalToNumber(input.longitude) === null) {
    return 'SEM_LOCALIZACAO';
  }

  const tipos = input.tiposPendencia ?? LEGACY_TIPOS_PENDENCIA;
  if (
    hasPendenciaAtiva(
      {
        chamadosAbertos: input.chamadosAbertos,
        naoConformidadesAbertas: input.naoConformidadesAbertas,
        semVistoria: Boolean(input.semVistoria),
      },
      tipos,
    )
  ) {
    return 'COM_PENDENCIAS';
  }

  return 'OPERACIONAL';
}

export function resolveUnidadeSlaMapa(chamadosAbertos: number, chamadosSlaForaPrazo: number): UnidadeSlaMapa {
  if (chamadosAbertos <= 0) return null;
  return chamadosSlaForaPrazo > 0 ? 'FORA' : 'DENTRO';
}

/**
 * Contagem de pendências únicas (item a item).
 * SLA dentro/fora é só classificação visual — nunca entra nesta soma.
 * NC com chamado aberto conta só no chamado (evita duplicar NC + CH).
 */
export function countPendenciasUnicas(
  input: {
    chamadosAbertos: number;
    naoConformidadesSemChamadoAberto: number;
    vistoriasAtrasadas: number;
  },
  tiposPendencia: TipoPendencia[] = DEFAULT_TIPOS_PENDENCIA,
) {
  const tipos = tiposPendencia.length > 0 ? tiposPendencia : DEFAULT_TIPOS_PENDENCIA;
  let total = 0;
  if (tipos.includes('CHAMADOS')) total += Math.max(0, input.chamadosAbertos);
  if (tipos.includes('NAO_CONFORMIDADES')) total += Math.max(0, input.naoConformidadesSemChamadoAberto);
  if (tipos.includes('VISTORIAS')) total += Math.max(0, input.vistoriasAtrasadas);
  return total;
}

export function mapUnidadeOperacional(
  unidade: UnidadeBaseRecord,
  counts: UnidadeResumoCounts & { naoConformidadesSemChamadoAberto?: number },
  ultimaVistoriaNota?: UnidadeVistoriaNotaResumo | null,
  tiposPendencia?: TipoPendencia[],
): UnidadeOperacional {
  const tipos = tiposPendencia ?? LEGACY_TIPOS_PENDENCIA;
  const situacao = deriveUnidadeSituacao({
    ativo: unidade.ativo,
    latitude: unidade.latitude,
    longitude: unidade.longitude,
    naoConformidadesAbertas: counts.naoConformidadesAbertas,
    chamadosAbertos: counts.chamadosAbertos,
    semVistoria: counts.semVistoria,
    tiposPendencia: tipos,
  });

  const naoConformidadesSemChamadoAberto =
    counts.naoConformidadesSemChamadoAberto ?? counts.naoConformidadesAbertas;
  const vistoriasAtrasadas = counts.semVistoria ? 1 : 0;
  const pendenciasUnicas = countPendenciasUnicas(
    {
      chamadosAbertos: counts.chamadosAbertos,
      naoConformidadesSemChamadoAberto,
      vistoriasAtrasadas,
    },
    tipos,
  );

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
      naoConformidadesSemChamadoAberto,
      chamadosAbertos: counts.chamadosAbertos,
      semVistoria: counts.semVistoria,
      vistoriaAtrasada: null,
    },
    pendenciasUnicas,
    totais: counts,
    slaMapa: resolveUnidadeSlaMapa(counts.chamadosAbertos, counts.chamadosSlaForaPrazo),
    ultimaVistoriaNota: ultimaVistoriaNota ?? null,
  };
}

export function applyInMemoryUnidadeFilters<T extends UnidadeOperacional>(
  unidades: T[],
  filters: {
    situacao?: UnidadeSituacao;
    pendencias?: boolean;
    tiposPendencia?: TipoPendencia[];
    sla?: 'DENTRO' | 'FORA';
  },
) {
  const tipos = filters.tiposPendencia;

  return unidades.filter((unidade) => {
    if (filters.situacao && unidade.situacao !== filters.situacao) {
      return false;
    }

    if (filters.pendencias !== undefined) {
      const hasPendencias = tipos
        ? hasPendenciaAtiva(
            {
              chamadosAbertos: unidade.pendencias.chamadosAbertos,
              naoConformidadesAbertas: unidade.pendencias.naoConformidadesAbertas,
              semVistoria: unidade.pendencias.semVistoria,
            },
            tipos,
          )
        : unidade.pendencias.naoConformidadesAbertas > 0 || unidade.pendencias.chamadosAbertos > 0;

      if (hasPendencias !== filters.pendencias) {
        return false;
      }
    }

    if (filters.sla) {
      if (unidade.slaMapa !== filters.sla) {
        return false;
      }
    }

    return true;
  });
}
