import { describe, expect, it } from 'vitest';
import { buildXlsx, isXlsxBuffer } from './relatorios.xlsx';

describe('relatorios.xlsx', () => {
  it('gera arquivo xlsx com assinatura zip', async () => {
    const buffer = await buildXlsx('Chamados', ['codigo', 'status'], [['CH-2026-000001', 'ABERTO']]);
    expect(isXlsxBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(100);
  });

  it('normaliza valores decimais do prisma', async () => {
    const buffer = await buildXlsx(
      'Proprios',
      ['latitude'],
      [[{ toString: () => '-20.538600' }]],
    );
    expect(isXlsxBuffer(buffer)).toBe(true);
  });
});
