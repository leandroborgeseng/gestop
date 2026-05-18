import { describe, expect, it } from 'vitest';
import {
  applyInMemoryUnidadeFilters,
  deriveUnidadeSituacao,
  mapUnidadeOperacional,
} from './operacional.mapper';

const baseUnidade = {
  id: 'unidade-1',
  codigoPatrimonial: 'PMF-ESC-001',
  nome: 'EMEB Teste',
  tipo: 'ESCOLA' as const,
  endereco: 'Rua Teste, 100',
  bairro: 'Centro',
  cep: '14400-000',
  latitude: -20.53936,
  longitude: -47.40081,
  raioValidacaoMetros: 200,
  ativo: true,
  secretaria: {
    id: 'sec-1',
    nome: 'Secretaria de Educacao',
    sigla: 'SME',
  },
};

describe('mapeamento operacional de unidades', () => {
  it('classifica unidade ativa sem pendencias como operacional', () => {
    expect(
      deriveUnidadeSituacao({
        ativo: true,
        latitude: -20.53936,
        longitude: -47.40081,
        naoConformidadesAbertas: 0,
        ordensServicoAbertas: 0,
      }),
    ).toBe('OPERACIONAL');
  });

  it('prioriza situacao inativa', () => {
    expect(
      deriveUnidadeSituacao({
        ativo: false,
        latitude: -20.53936,
        longitude: -47.40081,
        naoConformidadesAbertas: 3,
        ordensServicoAbertas: 2,
      }),
    ).toBe('INATIVA');
  });

  it('classifica unidade com pendencias abertas', () => {
    const unidade = mapUnidadeOperacional(baseUnidade, {
      fiscalizacoes: 2,
      naoConformidadesAbertas: 1,
      ordensServicoAbertas: 1,
    });

    expect(unidade.situacao).toBe('COM_PENDENCIAS');
    expect(unidade.pendencias.ordensServicoAbertas).toBe(1);
  });

  it('filtra lista por situacao e pendencias', () => {
    const operacional = mapUnidadeOperacional(baseUnidade, {
      fiscalizacoes: 1,
      naoConformidadesAbertas: 0,
      ordensServicoAbertas: 0,
    });
    const pendente = mapUnidadeOperacional(
      { ...baseUnidade, id: 'unidade-2', nome: 'UBS Teste', tipo: 'UBS' },
      {
        fiscalizacoes: 1,
        naoConformidadesAbertas: 0,
        ordensServicoAbertas: 2,
      },
    );

    expect(
      applyInMemoryUnidadeFilters([operacional, pendente], {
        situacao: 'COM_PENDENCIAS',
        pendencias: true,
      }),
    ).toEqual([pendente]);
  });
});
