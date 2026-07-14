import { ChecklistItemTipo } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import {
  assertValidChecklistVersionItems,
  normalizeChecklistItemOpcoes,
  validateChecklistItemOpcoes,
} from './checklist-item.rules';

describe('checklist-item.rules', () => {
  it('normaliza opcoes de multipla escolha com notas alinhadas', () => {
    expect(
      normalizeChecklistItemOpcoes(ChecklistItemTipo.MULTIPLA_ESCOLHA, {
        opcoes: [' A ', 'B', ''],
        notas: [8, 5, 1],
        modoExibicao: 'LISTA',
      }),
    ).toEqual({
      opcoes: ['A', 'B'],
      notas: [8, 5],
      modoExibicao: 'LISTA',
    });
  });

  it('rejeita multipla escolha com menos de 2 opcoes', () => {
    expect(
      validateChecklistItemOpcoes(ChecklistItemTipo.MULTIPLA_ESCOLHA, { opcoes: ['Unica'] }, 'Pergunta', 'P1'),
    ).toContain('2 opcoes');
  });

  it('exige todas as notas quando qualquer opcao possui nota', () => {
    expect(
      validateChecklistItemOpcoes(
        ChecklistItemTipo.MULTIPLA_ESCOLHA,
        { opcoes: ['A', 'B'], notas: [8, null], modoExibicao: 'SELECT' },
        'Pergunta',
        'P1',
      ),
    ).toContain('todas as opcoes');
  });

  it('normaliza booleano com pontuacao e conformidade', () => {
    expect(
      normalizeChecklistItemOpcoes(ChecklistItemTipo.BOOLEANO, {
        pontuar: true,
        notaSim: 9,
        notaNao: 1,
        simConformidade: 'NAO_CONFORME',
        naoConformidade: 'CONFORME',
      }),
    ).toEqual({
      pontuar: true,
      notaSim: 9,
      notaNao: 1,
      simConformidade: 'NAO_CONFORME',
      naoConformidade: 'CONFORME',
    });
  });

  it('exige notas Sim/Nao quando pontuar', () => {
    expect(
      validateChecklistItemOpcoes(
        ChecklistItemTipo.BOOLEANO,
        { pontuar: true, notaSim: 8, simConformidade: 'CONFORME' },
        'Pergunta',
        'B1',
      ),
    ).toContain('Sim e Nao');
  });

  it('normaliza escala Likert padrao', () => {
    expect(normalizeChecklistItemOpcoes(ChecklistItemTipo.ESCALA_LIKERT, undefined)).toEqual({
      niveis: ['PESSIMO', 'RUIM', 'REGULAR', 'BOM', 'OTIMO'],
    });
  });

  it('preserva conformidadePorNivel na Likert', () => {
    expect(
      normalizeChecklistItemOpcoes(ChecklistItemTipo.ESCALA_LIKERT, {
        niveis: ['RUIM', 'BOM'],
        conformidadePorNivel: { RUIM: 'CONFORME', BOM: 'NAO_CONFORME' },
      }),
    ).toEqual({
      niveis: ['RUIM', 'BOM'],
      conformidadePorNivel: { RUIM: 'CONFORME', BOM: 'NAO_CONFORME' },
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
          categoriaVistoriaId: 'cat-1',
        },
        {
          ordem: 2,
          codigo: 'a-1',
          titulo: 'Item B',
          tipo: ChecklistItemTipo.BOOLEANO,
          obrigatorio: true,
          geraNaoConformidade: false,
          exigeEvidencia: false,
          categoriaVistoriaId: 'cat-1',
        },
      ]),
    ).toThrow('Codigo duplicado');
  });
});
