import { ChecklistVersaoStatus } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import {
  assertDraftEditable,
  canEditChecklistVersion,
  nextChecklistVersion,
  normalizeItemCode,
} from './checklist.rules';

describe('regras de versionamento de checklists', () => {
  it('permite editar apenas versoes em rascunho', () => {
    expect(canEditChecklistVersion(ChecklistVersaoStatus.RASCUNHO)).toBe(true);
    expect(canEditChecklistVersion(ChecklistVersaoStatus.PUBLICADA)).toBe(false);
    expect(canEditChecklistVersion(ChecklistVersaoStatus.ARQUIVADA)).toBe(false);
  });

  it('bloqueia edicao retroativa de versao publicada', () => {
    expect(() => assertDraftEditable(ChecklistVersaoStatus.PUBLICADA)).toThrow(
      'Somente versoes em rascunho podem ser editadas',
    );
  });

  it('calcula a proxima versao incremental', () => {
    expect(nextChecklistVersion([])).toBe(1);
    expect(nextChecklistVersion([{ versao: 1 }, { versao: 3 }, { versao: 2 }])).toBe(4);
  });

  it('normaliza codigo de item', () => {
    expect(normalizeItemCode(' ilu 001 ')).toBe('ILU-001');
  });
});
