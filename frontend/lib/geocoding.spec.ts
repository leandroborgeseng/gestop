import { describe, expect, it } from 'vitest';
import { collectDistrictCandidates, formatGeocodeLabel, pickBairro } from './geocoding';

describe('geocoding bairro', () => {
  it('prioriza bairro amplo em vez de microárea (Vila)', () => {
    const displayName =
      '1426, Rua Frederico Moura, Cidade Nova, Vila de Santa Tereza, Franca, Região Imediata de Franca, SP, Brasil';
    const candidates = collectDistrictCandidates(
      {
        suburb: 'Vila de Santa Tereza',
        neighbourhood: 'Cidade Nova',
      },
      displayName,
    );

    expect(pickBairro(candidates)).toBe('Cidade Nova');
  });

  it('monta label sem microárea irrelevante', () => {
    const label = formatGeocodeLabel(
      {
        logradouro: 'Rua Frederico Moura',
        numero: '1426',
        bairro: 'Cidade Nova',
        cidade: 'Franca',
      },
      '1426, Rua Frederico Moura, Cidade Nova, Vila de Santa Tereza, Franca',
    );

    expect(label).toBe('Rua Frederico Moura, 1426, Cidade Nova, Franca');
    expect(label).not.toContain('Vila de Santa Tereza');
  });
});
