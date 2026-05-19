import { ChecklistVersaoStatus } from '@prisma/client';

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
