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

  it('nunca ultrapassa 10', () => {
    expect(clampNota(10.4)).toBe(10);
    expect(clampNota(-1)).toBe(0);
  });
});
