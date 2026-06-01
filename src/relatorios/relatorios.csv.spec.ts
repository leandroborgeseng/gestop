import { describe, expect, it } from 'vitest';
import { buildCsv, escapeCsvValue } from './relatorios.csv';

describe('relatorios.csv', () => {
  it('escapa valores com virgula e aspas', () => {
    expect(escapeCsvValue('texto, com virgula')).toBe('"texto, com virgula"');
    expect(escapeCsvValue('diz "oi"')).toBe('"diz ""oi"""');
  });

  it('gera csv com bom utf-8', () => {
    const csv = buildCsv(['nome', 'valor'], [['Escola A', 10]]);
    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv).toContain('nome,valor');
    expect(csv).toContain('Escola A,10');
  });
});
