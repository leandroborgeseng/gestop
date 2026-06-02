import { ChecklistVersaoStatus, ChecklistEscopo } from '@prisma/client';
import { ChecklistDto } from './checklists.dto';

export function canEditChecklistVersion(status: ChecklistVersaoStatus) {
  return status === ChecklistVersaoStatus.RASCUNHO;
}

export function nextChecklistVersion(currentVersions: Array<{ versao: number }>) {
  if (currentVersions.length === 0) {
    return 1;
  }

  return Math.max(...currentVersions.map((item) => item.versao)) + 1;
}

export function assertDraftEditable(status: ChecklistVersaoStatus) {
  if (!canEditChecklistVersion(status)) {
    throw new Error('Somente versoes em rascunho podem ser editadas');
  }
}

export function normalizeItemCode(code: string) {
  return code.trim().toUpperCase().replace(/\s+/g, '-');
}

export function validateChecklistEscopo(dto: ChecklistDto) {
  if (dto.escopo === ChecklistEscopo.UNIDADE_TIPO && !dto.unidadeTipo) {
    throw new Error('Informe o tipo de proprio para checklists com escopo por tipo.');
  }

  if (dto.escopo === ChecklistEscopo.SECRETARIA && !dto.secretariaId) {
    throw new Error('Informe a secretaria para checklists com escopo por secretaria.');
  }

  if (dto.escopo === ChecklistEscopo.UNIDADE && !dto.unidadeId) {
    throw new Error('Informe o proprio para checklists com escopo por unidade.');
  }
}

export function normalizeChecklistBinding(dto: ChecklistDto): ChecklistDto {
  const base = {
    ...dto,
    secretariaId: dto.secretariaId || undefined,
    unidadeId: dto.unidadeId || undefined,
    unidadeTipo: dto.unidadeTipo || undefined,
  };

  switch (dto.escopo) {
    case ChecklistEscopo.GLOBAL:
      return { ...base, secretariaId: undefined, unidadeId: undefined, unidadeTipo: undefined };
    case ChecklistEscopo.SECRETARIA:
      return { ...base, unidadeId: undefined, unidadeTipo: undefined };
    case ChecklistEscopo.UNIDADE_TIPO:
      return { ...base, unidadeId: undefined };
    case ChecklistEscopo.UNIDADE:
      return { ...base, unidadeTipo: undefined };
    default:
      return base;
  }
}
