import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { normalizarAnexosAbertura } from './chamado-anexos-abertura';

function dataUrl(mime: string, bytes: number) {
  return `data:${mime};base64,${Buffer.alloc(bytes, 1).toString('base64')}`;
}

describe('normalizarAnexosAbertura', () => {
  it('aceita imagem e PDF e guarda o nome informado', () => {
    const anexos = normalizarAnexosAbertura({
      anexos: [
        { dataUrl: dataUrl('image/jpeg', 32), nome: 'fachada.jpg' },
        { dataUrl: dataUrl('application/pdf', 40), nome: 'laudo.pdf', mimeType: 'application/pdf' },
      ],
    });

    expect(anexos.map((item) => item.categoria)).toEqual(['imagem', 'pdf']);
    expect(anexos[0]?.nome).toBe('fachada.jpg');
    expect(anexos[1]?.extensao).toBe('pdf');
  });

  it('trata a foto única antiga como um anexo de imagem', () => {
    const anexos = normalizarAnexosAbertura({ fotoDataUrl: dataUrl('image/png', 16) });
    expect(anexos).toHaveLength(1);
    expect(anexos[0]?.categoria).toBe('imagem');
    expect(anexos[0]?.mimeType).toBe('image/png');
  });

  it('recusa formato fora da lista', () => {
    expect(() =>
      normalizarAnexosAbertura({ anexos: [{ dataUrl: dataUrl('image/gif', 8), nome: 'animacao.gif' }] }),
    ).toThrow(BadRequestException);
  });

  it('recusa mais arquivos do que o limite', () => {
    const anexos = Array.from({ length: 9 }, (_, index) => ({
      dataUrl: dataUrl('image/jpeg', 8),
      nome: `foto-${index}.jpg`,
    }));
    expect(() => normalizarAnexosAbertura({ anexos })).toThrow(/no máximo 8/);
  });
});
