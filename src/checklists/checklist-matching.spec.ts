import { ChecklistEscopo, UnidadeTipo } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { checklistAppliesToUnidade } from './checklist-matching';

const unidadeEscola = {
  id: 'unidade-1',
  tipo: UnidadeTipo.ESCOLA,
  secretariaId: 'sec-educacao',
};

describe('checklistAppliesToUnidade', () => {
  it('aplica checklist global a qualquer proprio', () => {
    expect(
      checklistAppliesToUnidade({ escopo: ChecklistEscopo.GLOBAL, ativo: true }, unidadeEscola),
    ).toBe(true);
  });

  it('aplica checklist por tipo de proprio', () => {
    expect(
      checklistAppliesToUnidade(
        {
          escopo: ChecklistEscopo.UNIDADE_TIPO,
          unidadeTipo: UnidadeTipo.ESCOLA,
          ativo: true,
        },
        unidadeEscola,
      ),
    ).toBe(true);

    expect(
      checklistAppliesToUnidade(
        {
          escopo: ChecklistEscopo.UNIDADE_TIPO,
          unidadeTipo: UnidadeTipo.UBS,
          ativo: true,
        },
        unidadeEscola,
      ),
    ).toBe(false);
  });

  it('restringe checklist por tipo e secretaria quando ambos informados', () => {
    expect(
      checklistAppliesToUnidade(
        {
          escopo: ChecklistEscopo.UNIDADE_TIPO,
          unidadeTipo: UnidadeTipo.ESCOLA,
          secretariaId: 'sec-educacao',
          ativo: true,
        },
        unidadeEscola,
      ),
    ).toBe(true);

    expect(
      checklistAppliesToUnidade(
        {
          escopo: ChecklistEscopo.UNIDADE_TIPO,
          unidadeTipo: UnidadeTipo.ESCOLA,
          secretariaId: 'sec-saude',
          ativo: true,
        },
        unidadeEscola,
      ),
    ).toBe(false);
  });

  it('aplica checklist por secretaria', () => {
    expect(
      checklistAppliesToUnidade(
        {
          escopo: ChecklistEscopo.SECRETARIA,
          secretariaId: 'sec-educacao',
          ativo: true,
        },
        unidadeEscola,
      ),
    ).toBe(true);
  });
});
