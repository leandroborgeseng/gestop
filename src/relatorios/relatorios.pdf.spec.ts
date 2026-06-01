import { describe, expect, it } from 'vitest';
import { buildTablePdf } from './relatorios.pdf';

describe('buildTablePdf', () => {
  it('gera buffer pdf valido', async () => {
    const buffer = await buildTablePdf({
      title: 'GestOP — Teste',
      headers: ['Coluna A', 'Coluna B'],
      rows: [['Valor 1', 'Valor 2']],
    });

    expect(buffer.length).toBeGreaterThan(100);
    expect(buffer.subarray(0, 4).toString()).toBe('%PDF');
  });
});
