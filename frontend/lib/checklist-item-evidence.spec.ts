import { describe, expect, it } from 'vitest';
import {
  buildRespostaPayload,
  getResponseEvidencias,
  validateItemResponse,
  type ResponseDraft,
} from './checklist-response-draft';
import type { ChecklistItem } from '@/lib/types';

function item(partial: Partial<ChecklistItem> & Pick<ChecklistItem, 'id' | 'titulo' | 'tipo'>): ChecklistItem {
  return {
    ordem: 1,
    codigo: 'Q1',
    obrigatorio: true,
    exigeEvidencia: false,
    geraNaoConformidade: false,
    ...partial,
  } as ChecklistItem;
}

describe('getResponseEvidencias', () => {
  it('normaliza rascunho legado com uma única foto', () => {
    const draft: ResponseDraft = {
      conformidade: 'NAO_CONFORME',
      comentario: 'obs',
      evidenceDataUrl: 'data:image/jpeg;base64,abc',
      evidenceMimeType: 'image/jpeg',
      evidenceSize: 10,
    };
    expect(getResponseEvidencias(draft)).toHaveLength(1);
    expect(getResponseEvidencias(draft)[0]?.dataUrl).toContain('data:image');
  });

  it('usa a lista evidencias quando presente', () => {
    const draft: ResponseDraft = {
      conformidade: 'CONFORME',
      comentario: '',
      evidencias: [
        { id: 'a', dataUrl: 'data:image/jpeg;base64,a' },
        { id: 'b', dataUrl: 'data:image/jpeg;base64,b' },
      ],
    };
    expect(getResponseEvidencias(draft)).toHaveLength(2);
  });
});

describe('validateItemResponse evidências', () => {
  it('bloqueia NC com exigeEvidencia sem fotos', () => {
    const message = validateItemResponse(
      item({ id: '1', titulo: 'Iluminação', tipo: 'BOOLEANO', exigeEvidencia: true }),
      { conformidade: 'NAO_CONFORME', comentario: 'Queimada', valorBooleano: false },
    );
    expect(message).toMatch(/evidência fotográfica/i);
  });

  it('aceita múltiplas fotos anexadas', () => {
    const message = validateItemResponse(
      item({ id: '1', titulo: 'Foto', tipo: 'FOTO' }),
      {
        conformidade: 'CONFORME',
        comentario: '',
        evidencias: [
          { id: 'a', dataUrl: 'data:image/jpeg;base64,a' },
          { id: 'b', dataUrl: 'data:image/jpeg;base64,b' },
        ],
      },
    );
    expect(message).toBeNull();
  });
});

describe('buildRespostaPayload', () => {
  it('envia todas as evidências do item', () => {
    const payload = buildRespostaPayload(
      item({ id: '1', titulo: 'Foto', tipo: 'FOTO' }),
      {
        conformidade: 'CONFORME',
        comentario: '',
        evidencias: [
          { id: 'a', dataUrl: 'data:image/jpeg;base64,a', mimeType: 'image/jpeg', size: 1 },
          { id: 'b', dataUrl: 'data:image/jpeg;base64,b', mimeType: 'image/jpeg', size: 2 },
        ],
      },
      { latitude: -20, longitude: -47, precisaoMetros: 10 },
      '2026-07-15T12:00:00.000Z',
    );
    expect(payload.evidencias).toHaveLength(2);
    expect(payload.evidencias[0]?.url).toContain('base64,a');
  });

  it('inclui gerarChamado apenas em NC com item marcado', () => {
    const withFlag = buildRespostaPayload(
      item({ id: '1', titulo: 'NC', tipo: 'BOOLEANO', geraNaoConformidade: true }),
      { conformidade: 'NAO_CONFORME', comentario: 'problema', gerarChamado: false, valorBooleano: false },
      { latitude: -20, longitude: -47, precisaoMetros: 10 },
      '2026-07-15T12:00:00.000Z',
    );
    expect(withFlag.gerarChamado).toBe(false);

    const defaultOn = buildRespostaPayload(
      item({ id: '1', titulo: 'NC', tipo: 'BOOLEANO', geraNaoConformidade: true }),
      { conformidade: 'NAO_CONFORME', comentario: 'problema', valorBooleano: false },
      { latitude: -20, longitude: -47, precisaoMetros: 10 },
      '2026-07-15T12:00:00.000Z',
    );
    expect(defaultOn.gerarChamado).toBe(true);

    const conforme = buildRespostaPayload(
      item({ id: '1', titulo: 'OK', tipo: 'BOOLEANO', geraNaoConformidade: true }),
      { conformidade: 'CONFORME', comentario: '', valorBooleano: true },
      { latitude: -20, longitude: -47, precisaoMetros: 10 },
      '2026-07-15T12:00:00.000Z',
    );
    expect(conforme.gerarChamado).toBeUndefined();
  });
});
