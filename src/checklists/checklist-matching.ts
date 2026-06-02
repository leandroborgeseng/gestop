import { ChecklistEscopo, UnidadeTipo } from '@prisma/client';

export type ChecklistBinding = {
  escopo: ChecklistEscopo;
  secretariaId?: string | null;
  unidadeId?: string | null;
  unidadeTipo?: UnidadeTipo | null;
  ativo?: boolean;
};

export type UnidadeBinding = {
  id: string;
  tipo: UnidadeTipo;
  secretariaId: string;
};

export function checklistAppliesToUnidade(checklist: ChecklistBinding, unidade: UnidadeBinding): boolean {
  if (checklist.ativo === false) {
    return false;
  }

  switch (checklist.escopo) {
    case ChecklistEscopo.GLOBAL:
      return true;
    case ChecklistEscopo.SECRETARIA:
      return Boolean(checklist.secretariaId && checklist.secretariaId === unidade.secretariaId);
    case ChecklistEscopo.UNIDADE_TIPO:
      if (!checklist.unidadeTipo || checklist.unidadeTipo !== unidade.tipo) {
        return false;
      }
      if (checklist.secretariaId && checklist.secretariaId !== unidade.secretariaId) {
        return false;
      }
      return true;
    case ChecklistEscopo.UNIDADE:
      return Boolean(checklist.unidadeId && checklist.unidadeId === unidade.id);
    default:
      return false;
  }
}

export function filterChecklistsForUnidade<T extends ChecklistBinding>(
  checklists: T[],
  unidade: UnidadeBinding,
): T[] {
  return checklists.filter((checklist) => checklistAppliesToUnidade(checklist, unidade));
}
