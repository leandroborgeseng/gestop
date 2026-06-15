import { describe, expect, it } from 'vitest';
import {
  collectDistrictCandidates,
  formatGeocodeLabel,
  interpolateHouseOnBoundingBoxForTest,
  pickBairro,
  resolveCoordsFromItemsForTest,
} from './geocoding';

const FREDERICO_MOURA_ADDRESS = {
  road: 'Rua Frederico Moura',
  neighbourhood: 'Cidade Nova',
  quarter: 'Cidade Nova',
  suburb: 'Vila de Santa Tereza',
  city_district: 'Franca',
  city: 'Franca',
};

const FREDERICO_MOURA_DISPLAY =
  'Rua Frederico Moura, Cidade Nova, Vila de Santa Tereza, Franca, São Paulo, Região Sudeste, 14401-161, Brasil';

describe('geocoding bairro', () => {
  it('prioriza bairro oficial (neighbourhood) em vez de microárea e município', () => {
    const candidates = collectDistrictCandidates(FREDERICO_MOURA_ADDRESS, FREDERICO_MOURA_DISPLAY);

    expect(candidates[0]).toBe('Cidade Nova');
    expect(pickBairro(candidates)).toBe('Cidade Nova');
    expect(candidates).not.toContain('Franca');
    expect(candidates).not.toContain('Vila de Santa Tereza');
  });

  it('monta label sem microárea irrelevante', () => {
    const label = formatGeocodeLabel(
      {
        logradouro: 'Rua Frederico Moura',
        numero: '1426',
        bairro: 'Cidade Nova',
        cidade: 'Franca',
      },
      FREDERICO_MOURA_DISPLAY,
    );

    expect(label).toBe('Rua Frederico Moura, 1426, Cidade Nova, Franca');
    expect(label).not.toContain('Vila de Santa Tereza');
  });

  it('sanitiza fallback do Nominatim sem microárea', () => {
    const label = formatGeocodeLabel(
      {
        logradouro: 'Rua Frederico Moura',
        bairro: '',
        cidade: 'Franca',
      },
      FREDERICO_MOURA_DISPLAY,
    );

    expect(label).toBe('Rua Frederico Moura, Cidade Nova, Franca');
    expect(label).not.toContain('Vila de Santa Tereza');
  });
});

describe('geocoding pin por número', () => {
  it('interpola coordenadas diferentes conforme o número na mesma rua', () => {
    const bbox: [string, string, string, string] = ['-20.5291869', '-20.5266039', '-47.3959089', '-47.3931616'];

    const pin100 = interpolateHouseOnBoundingBoxForTest(bbox, 100);
    const pin500 = interpolateHouseOnBoundingBoxForTest(bbox, 500);

    expect(pin100.latitude).not.toBe(pin500.latitude);
    expect(pin100.longitude).not.toBe(pin500.longitude);
  });

  it('usa segmentos distintos da rua quando o número muda', () => {
    const roads = [
      {
        display_name: 'Rua Frederico Moura, Cidade Nova, Franca',
        lat: '-20.5278772',
        lon: '-47.3945179',
        class: 'highway',
        addresstype: 'road',
        importance: 0.05,
        boundingbox: ['-20.5291869', '-20.5266039', '-47.3959089', '-47.3931616'] as [string, string, string, string],
        address: { road: 'Rua Frederico Moura' },
      },
      {
        display_name: 'Rua Frederico Moura, Cidade Nova, Franca',
        lat: '-20.5299934',
        lon: '-47.3923137',
        class: 'highway',
        addresstype: 'road',
        importance: 0.04,
        boundingbox: ['-20.5308005', '-20.5291869', '-47.3931616', '-47.3914664'] as [string, string, string, string],
        address: { road: 'Rua Frederico Moura' },
      },
    ];

    const pin100 = resolveCoordsFromItemsForTest(roads, 'Rua Frederico Moura', 100);
    const pin1500 = resolveCoordsFromItemsForTest(roads, 'Rua Frederico Moura', 1500);

    expect(pin100).not.toBeNull();
    expect(pin1500).not.toBeNull();
    expect(pin100?.latitude).not.toBe(pin1500?.latitude);
  });
});
