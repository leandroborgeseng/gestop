import { describe, expect, it } from 'vitest';
import { isEvidenciaImagem, particionarEvidencias, rotuloAnexo } from './evidencia-midia';

describe('#311 CCO-V4 — classificação de evidências', () => {
  it('FOTO/ASSINATURA e image/* vão para o lightbox', () => {
    expect(isEvidenciaImagem({ url: 'x', tipo: 'FOTO' })).toBe(true);
    expect(isEvidenciaImagem({ url: 'x', tipo: 'ASSINATURA' })).toBe(true);
    expect(isEvidenciaImagem({ url: 'x', mimeType: 'image/jpeg' })).toBe(true);
  });

  it('DOCUMENTO/VIDEO/AUDIO e mime não-imagem não entram no viewer de imagem', () => {
    expect(isEvidenciaImagem({ url: 'a.pdf', tipo: 'DOCUMENTO' })).toBe(false);
    expect(isEvidenciaImagem({ url: 'a', tipo: 'VIDEO' })).toBe(false);
    expect(isEvidenciaImagem({ url: 'a', mimeType: 'application/pdf' })).toBe(false);
  });

  it('particiona fotos e anexos preservando ordem', () => {
    const { fotos, anexos } = particionarEvidencias([
      { id: '1', url: 'a.jpg', tipo: 'FOTO' },
      { id: '2', url: 'b.pdf', tipo: 'DOCUMENTO', mimeType: 'application/pdf' },
      { id: '3', url: 'c.png', mimeType: 'image/png' },
    ]);
    expect(fotos.map((f) => f.id)).toEqual(['1', '3']);
    expect(anexos.map((a) => a.id)).toEqual(['2']);
    expect(rotuloAnexo(anexos[0], 0)).toBe('Anexo 1.pdf');
  });
});
