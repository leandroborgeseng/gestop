import { ChecklistEscopo } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { buildFieldPackageChecklistWhere } from './field-package';

describe('buildFieldPackageChecklistWhere', () => {
  it('inclui checklists por tipo de próprio para usuário de secretaria', () => {
    const where = buildFieldPackageChecklistWhere('sec-educacao');

    expect(where.OR).toEqual(
      expect.arrayContaining([
        { escopo: ChecklistEscopo.GLOBAL },
        { escopo: ChecklistEscopo.SECRETARIA, secretariaId: 'sec-educacao' },
        { escopo: ChecklistEscopo.UNIDADE_TIPO, secretariaId: null },
        { escopo: ChecklistEscopo.UNIDADE_TIPO, secretariaId: 'sec-educacao' },
        {
          escopo: ChecklistEscopo.UNIDADE,
          unidade: { secretariaId: 'sec-educacao', ativo: true },
        },
      ]),
    );
  });

  it('inclui todos os escopos por tipo e por unidade para usuário sem secretaria', () => {
    const where = buildFieldPackageChecklistWhere(null);

    expect(where.OR).toEqual(
      expect.arrayContaining([
        { escopo: ChecklistEscopo.GLOBAL },
        { escopo: ChecklistEscopo.UNIDADE_TIPO, secretariaId: null },
        { escopo: ChecklistEscopo.UNIDADE_TIPO },
        {
          escopo: ChecklistEscopo.UNIDADE,
          unidade: { ativo: true },
        },
      ]),
    );
  });
});
