import { describe, expect, it } from 'vitest';

const ALLOWED_EVIDENCE_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic']);

function assertAllowedMime(mimeType: string) {
  if (!ALLOWED_EVIDENCE_MIMES.has(mimeType.toLowerCase())) {
    throw new Error(`Tipo de arquivo nao permitido: ${mimeType}`);
  }
}

describe('storage MIME allowlist', () => {
  it('aceita formatos de imagem comuns', () => {
    expect(() => assertAllowedMime('image/jpeg')).not.toThrow();
    expect(() => assertAllowedMime('image/png')).not.toThrow();
    expect(() => assertAllowedMime('image/webp')).not.toThrow();
  });

  it('rejeita tipos arbitrarios', () => {
    expect(() => assertAllowedMime('text/html')).toThrow(/nao permitido/);
    expect(() => assertAllowedMime('application/pdf')).toThrow(/nao permitido/);
  });
});
