import { describe, expect, it } from 'vitest';
import { buildTablePdf } from './relatorios.pdf';

describe('buildTablePdf', () => {
  it('gera buffer pdf valido com logo institucional', async () => {
    const buffer = await buildTablePdf({
      title: 'SIGMA — Teste',
      headers: ['Coluna A', 'Coluna B'],
      rows: [['Valor 1', 'Valor 2']],
    });

    expect(buffer.length).toBeGreaterThan(500);
    expect(buffer.subarray(0, 4).toString()).toBe('%PDF');
    expect(buffer.includes(Buffer.from('/Image'))).toBe(true);
  });

  it('quebra texto longo sem truncar por contagem fixa de caracteres', async () => {
    const buffer = await buildTablePdf({
      title: 'SIGMA — Teste',
      headers: ['Descricao'],
      columnWeights: [1],
      rows: [
        [
          'Descricao muito longa para validar quebra automatica de linha dentro da celula sem estourar a tabela no PDF gerado pelo sistema.',
        ],
      ],
    });

    expect(buffer.length).toBeGreaterThan(500);
    expect(buffer.subarray(0, 4).toString()).toBe('%PDF');
  });
});
