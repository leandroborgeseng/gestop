import { describe, expect, it } from 'vitest';
import { buildXlsx } from './relatorios.xlsx';

describe('relatorios.xlsx', () => {
  it('gera arquivo xlsx com assinatura zip', async () => {
    const buffer = await buildXlsx('Chamados', ['codigo', 'status'], [['CH-2026-000001', 'ABERTO']]);
    expect(buffer.subarray(0, 2).toString('utf8')).toBe('PK');
    expect(buffer.length).toBeGreaterThan(100);
  });
});
