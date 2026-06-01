import { describe, expect, it } from 'vitest';
import { buildChamadoCode } from './chamados.rules';

describe('buildChamadoCode', () => {
  it('formata codigo com ano e sequencia', () => {
    const year = new Date().getFullYear();
    expect(buildChamadoCode(1)).toBe(`CH-${year}-000001`);
    expect(buildChamadoCode(42)).toBe(`CH-${year}-000042`);
  });
});
