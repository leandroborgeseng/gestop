import { ChecklistItemTipo } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import {
  assertValidChecklistVersionItems,
  normalizeChecklistItemOpcoes,
  validateChecklistItemOpcoes,
} from './checklist-item.rules';

describe('checklist-item.rules', () => {
  it('normaliza opcoes de multipla escolha', () => {
    expect(normalizeChecklistItemOpcoes(ChecklistItemTipo.MULTIPLA_ESCOLHA, { opcoes: [' A ', 'B', ''], modoExibicao: 'LISTA' })).toEqual({
      opcoes: ['A', 'B'],
      modoExibicao: 'LISTA',
    });
  });

  it('rejeita multipla escolha com menos de 2 opcoes', () => {
    expect(
      validateChecklistItemOpcoes(ChecklistItemTipo.MULTIPLA_ESCOLHA, { opcoes: ['Unica'] }, 'Pergunta', 'P1'),
    ).toContain('2 opcoes');
  });

  it('normaliza escala Likert padrao', () => {
    expect(normalizeChecklistItemOpcoes(ChecklistItemTipo.ESCALA_LIKERT, undefined)).toEqual({
      niveis: ['PESSIMO', 'RUIM', 'REGULAR', 'BOM', 'OTIMO'],
    });
  });

  it('rejeita escala Likert com menos de 2 niveis', () => {
    expect(
      validateChecklistItemOpcoes(ChecklistItemTipo.ESCALA_LIKERT, { niveis: ['PESSIMO'] }, 'Estado', 'E1'),
    ).toContain('2');
  });

  it('rejeita codigos duplicados na versao', () => {
    expect(() =>
      assertValidChecklistVersionItems([
        {
          ordem: 1,
          codigo: 'A-1',
          titulo: 'Item A',
          tipo: ChecklistItemTipo.BOOLEANO,
          obrigatorio: true,
          geraNaoConformidade: false,
          exigeEvidencia: false,
        },
        {
          ordem: 2,
          codigo: 'a-1',
          titulo: 'Item B',
          tipo: ChecklistItemTipo.BOOLEANO,
          obrigatorio: true,
          geraNaoConformidade: false,
          exigeEvidencia: false,
        },
      ]),
    ).toThrow('Codigo duplicado');
  });
});
