import { ChecklistEscopo, ChecklistModel, UnidadeTipo } from '@/lib/types';

type UnidadeBinding = {
  id: string;
  tipo: UnidadeTipo;
  secretaria: { id: string };
};

export function checklistAppliesToUnidade(
  checklist: Pick<ChecklistModel, 'escopo' | 'secretariaId' | 'unidadeTipo' | 'ativo'> & {
    unidadeId?: string | null;
  },
  unidade: UnidadeBinding,
) {
  if (!checklist.ativo) {
    return false;
  }

  switch (checklist.escopo) {
    case 'GLOBAL':
      return true;
    case 'SECRETARIA':
      return Boolean(checklist.secretariaId && checklist.secretariaId === unidade.secretaria.id);
    case 'UNIDADE_TIPO':
      if (!checklist.unidadeTipo || checklist.unidadeTipo !== unidade.tipo) {
        return false;
      }
      if (checklist.secretariaId && checklist.secretariaId !== unidade.secretaria.id) {
        return false;
      }
      return true;
    case 'UNIDADE':
      return Boolean(checklist.unidadeId && checklist.unidadeId === unidade.id);
    default:
      return false;
  }
}

export function filterChecklistsForUnidade<T extends ChecklistModel>(
  checklists: T[],
  unidade: UnidadeBinding,
): T[] {
  return checklists.filter((checklist) => checklistAppliesToUnidade(checklist, unidade));
}

export type { ChecklistEscopo };
