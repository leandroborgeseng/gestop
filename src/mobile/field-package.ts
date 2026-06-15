import { ChecklistEscopo, Prisma } from '@prisma/client';

export function buildFieldPackageChecklistWhere(
  secretariaId?: string | null,
): Prisma.ChecklistWhereInput {
  const orConditions: Prisma.ChecklistWhereInput[] = [
    { escopo: ChecklistEscopo.GLOBAL },
    { escopo: ChecklistEscopo.UNIDADE_TIPO, secretariaId: null },
  ];

  if (secretariaId) {
    orConditions.push(
      { escopo: ChecklistEscopo.SECRETARIA, secretariaId },
      { escopo: ChecklistEscopo.UNIDADE_TIPO, secretariaId },
      {
        escopo: ChecklistEscopo.UNIDADE,
        unidade: { secretariaId, ativo: true },
      },
    );
  } else {
    orConditions.push(
      { escopo: ChecklistEscopo.UNIDADE_TIPO },
      {
        escopo: ChecklistEscopo.UNIDADE,
        unidade: { ativo: true },
      },
    );
  }

  return {
    ativo: true,
    versoes: { some: { status: 'PUBLICADA' } },
    OR: orConditions,
  };
}
