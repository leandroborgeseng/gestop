import { ChecklistItemTipo } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { clampNota, computeVistoriaNotas } from './vistoria-nota';

describe('vistoria-nota', () => {
  it('calcula média Likert geral e por categoria', () => {
    const result = computeVistoriaNotas([
      {
        valorTexto: 'BOM',
        item: {
          tipo: ChecklistItemTipo.ESCALA_LIKERT,
          categoriaVistoriaId: 'cat-piso',
          categoriaVistoria: { id: 'cat-piso', nome: 'Piso' },
        },
      },
      {
        valorTexto: 'OTIMO',
        item: {
          tipo: ChecklistItemTipo.ESCALA_LIKERT,
          categoriaVistoriaId: 'cat-piso',
          categoriaVistoria: { id: 'cat-piso', nome: 'Piso' },
        },
      },
      {
        valorTexto: 'REGULAR',
        item: {
          tipo: ChecklistItemTipo.ESCALA_LIKERT,
          categoriaVistoriaId: 'cat-pintura',
          categoriaVistoria: { id: 'cat-pintura', nome: 'Pintura' },
        },
      },
    ]);

    expect(result.notaGeral).toBe(7.7);
    expect(result.notasPorCategoria).toEqual([
      { categoriaId: 'cat-pintura', categoriaNome: 'Pintura', nota: 5 },
      { categoriaId: 'cat-piso', categoriaNome: 'Piso', nota: 9 },
    ]);
  });

  it('inclui múltipla escolha com notas e ignora opções sem nota', () => {
    const result = computeVistoriaNotas([
      {
        valorTexto: 'Bom',
        item: {
          tipo: ChecklistItemTipo.MULTIPLA_ESCOLHA,
          opcoes: { opcoes: ['Ruim', 'Bom'], notas: [2, 8], modoExibicao: 'SELECT' },
          categoriaVistoriaId: 'cat-a',
          categoriaVistoria: { id: 'cat-a', nome: 'Categoria A' },
        },
      },
      {
        valorTexto: 'Qualquer',
        item: {
          tipo: ChecklistItemTipo.MULTIPLA_ESCOLHA,
          opcoes: { opcoes: ['Qualquer', 'Outro'], modoExibicao: 'SELECT' },
          categoriaVistoriaId: 'cat-a',
          categoriaVistoria: { id: 'cat-a', nome: 'Categoria A' },
        },
      },
    ]);

    expect(result.notaGeral).toBe(8);
    expect(result.notasPorCategoria).toEqual([
      { categoriaId: 'cat-a', categoriaNome: 'Categoria A', nota: 8 },
    ]);
  });

  it('pontua Sim/Não apenas quando pontuar=true', () => {
    const comPontuacao = computeVistoriaNotas([
      {
        valorBooleano: true,
        item: {
          tipo: ChecklistItemTipo.BOOLEANO,
          opcoes: { pontuar: true, notaSim: 10, notaNao: 0 },
          categoriaVistoriaId: 'cat-b',
          categoriaVistoria: { id: 'cat-b', nome: 'Categoria B' },
        },
      },
      {
        valorBooleano: false,
        item: {
          tipo: ChecklistItemTipo.BOOLEANO,
          opcoes: { pontuar: true, notaSim: 10, notaNao: 4 },
          categoriaVistoriaId: 'cat-b',
          categoriaVistoria: { id: 'cat-b', nome: 'Categoria B' },
        },
      },
    ]);
    expect(comPontuacao.notaGeral).toBe(7);

    const semPontuacao = computeVistoriaNotas([
      {
        valorBooleano: true,
        item: {
          tipo: ChecklistItemTipo.BOOLEANO,
          opcoes: { simConformidade: 'CONFORME', naoConformidade: 'NAO_CONFORME' },
          categoriaVistoriaId: 'cat-b',
          categoriaVistoria: { id: 'cat-b', nome: 'Categoria B' },
        },
      },
    ]);
    expect(semPontuacao.notaGeral).toBeNull();
  });

  it('nunca ultrapassa 10', () => {
    expect(clampNota(10.4)).toBe(10);
    expect(clampNota(-1)).toBe(0);
  });
});
