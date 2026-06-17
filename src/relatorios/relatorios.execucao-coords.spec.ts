import { describe, expect, it } from 'vitest';
import { formatCoordenada } from './relatorios.execucao-coords';

describe('formatCoordenada', () => {
  it('formata latitude e longitude com 6 casas', () => {
    expect(formatCoordenada(-20.5386)).toBe('-20.538600');
    expect(formatCoordenada(47.40081)).toBe('47.400810');
  });

  it('retorna vazio quando coordenada ausente', () => {
    expect(formatCoordenada(null)).toBe('');
    expect(formatCoordenada(undefined)).toBe('');
  });
});
