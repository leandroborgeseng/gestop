import { describe, expect, it } from 'vitest';
import {
  applyInMemoryUnidadeFilters,
  deriveUnidadeSituacao,
  hasPendenciaAtiva,
  isChamadoForaPrazo,
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
        chamadosAbertos: 0,
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
        chamadosAbertos: 2,
      }),
    ).toBe('INATIVA');
  });

  it('classifica unidade com pendencias abertas', () => {
    const unidade = mapUnidadeOperacional(baseUnidade, {
      fiscalizacoes: 2,
      naoConformidadesAbertas: 1,
      chamadosAbertos: 1,
      chamadosSlaForaPrazo: 0,
      semVistoria: false,
    });

    expect(unidade.situacao).toBe('COM_PENDENCIAS');
    expect(unidade.pendencias.chamadosAbertos).toBe(1);
    expect(unidade.slaMapa).toBe('DENTRO');
  });

  it('marca SLA fora do prazo quando ha chamado atrasado', () => {
    const unidade = mapUnidadeOperacional(baseUnidade, {
      fiscalizacoes: 1,
      naoConformidadesAbertas: 0,
      chamadosAbertos: 2,
      chamadosSlaForaPrazo: 1,
      semVistoria: false,
    });

    expect(unidade.slaMapa).toBe('FORA');
  });

  it('considera vistoria atrasada (semVistoria) quando tiposPendencia inclui VISTORIAS', () => {
    expect(
      deriveUnidadeSituacao({
        ativo: true,
        latitude: -20.53936,
        longitude: -47.40081,
        naoConformidadesAbertas: 0,
        chamadosAbertos: 0,
        semVistoria: true,
        tiposPendencia: ['VISTORIAS'],
      }),
    ).toBe('COM_PENDENCIAS');

    expect(
      deriveUnidadeSituacao({
        ativo: true,
        latitude: -20.53936,
        longitude: -47.40081,
        naoConformidadesAbertas: 0,
        chamadosAbertos: 0,
        semVistoria: true,
        tiposPendencia: ['CHAMADOS'],
      }),
    ).toBe('OPERACIONAL');
  });

  it('filtra lista por situacao e pendencias', () => {
    const operacional = mapUnidadeOperacional(baseUnidade, {
      fiscalizacoes: 1,
      naoConformidadesAbertas: 0,
      chamadosAbertos: 0,
      chamadosSlaForaPrazo: 0,
      semVistoria: false,
    });
    const pendente = mapUnidadeOperacional(
      { ...baseUnidade, id: 'unidade-2', nome: 'UBS Teste', tipo: 'UBS' },
      {
        fiscalizacoes: 1,
        naoConformidadesAbertas: 0,
        chamadosAbertos: 2,
        chamadosSlaForaPrazo: 1,
        semVistoria: false,
      },
    );

    expect(
      applyInMemoryUnidadeFilters([operacional, pendente], {
        situacao: 'COM_PENDENCIAS',
        pendencias: true,
      }),
    ).toEqual([pendente]);

    expect(
      applyInMemoryUnidadeFilters([operacional, pendente], {
        sla: 'FORA',
      }),
    ).toEqual([pendente]);
  });

  it('detecta chamado fora do prazo por dia', () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    expect(isChamadoForaPrazo(yesterday)).toBe(true);
    expect(isChamadoForaPrazo(new Date())).toBe(true);
    expect(isChamadoForaPrazo(tomorrow)).toBe(false);
    expect(isChamadoForaPrazo(null)).toBe(false);
  });

  it('avalia tipos de pendencia selecionados', () => {
    expect(
      hasPendenciaAtiva(
        { chamadosAbertos: 0, naoConformidadesAbertas: 0, semVistoria: true },
        ['VISTORIAS'],
      ),
    ).toBe(true);
    expect(
      hasPendenciaAtiva(
        { chamadosAbertos: 1, naoConformidadesAbertas: 0, semVistoria: false },
        ['NAO_CONFORMIDADES'],
      ),
    ).toBe(false);
  });
});
