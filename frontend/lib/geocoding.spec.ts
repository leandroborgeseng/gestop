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

    expect(pin100.latitude !== pin500.latitude || pin100.longitude !== pin500.longitude).toBe(true);
  });

  it('usa segmentos distintos da rua quando o número muda', () => {
    const roads = [
      {
        display_name: 'Rua Frederico Moura, Cidade Nova, Franca',
        lat: '-20.5278772',
        lon: '-47.3945179',
        class: 'highway',
        addresstype: 'road',
        boundingbox: ['-20.5291869', '-20.5266039', '-47.3959089', '-47.3931616'] as [string, string, string, string],
        address: { road: 'Rua Frederico Moura' },
      },
      {
        display_name: 'Rua Frederico Moura, Cidade Nova, Franca',
        lat: '-20.5299934',
        lon: '-47.3923137',
        class: 'highway',
        addresstype: 'road',
        boundingbox: ['-20.5308005', '-20.5291869', '-47.3931616', '-47.3914664'] as [string, string, string, string],
        address: { road: 'Rua Frederico Moura' },
      },
    ];

    const pin100 = resolveCoordsFromItemsForTest(roads, 'Rua Frederico Moura', 100);
    const pin1500 = resolveCoordsFromItemsForTest(roads, 'Rua Frederico Moura', 1500);

    expect(pin100).not.toBeNull();
    expect(pin1500).not.toBeNull();
    expect(pin100?.precision).toBe('approximate');
    expect(pin100?.latitude !== pin1500?.latitude || pin100?.longitude !== pin1500?.longitude).toBe(true);
  });

  it('usa o número exato do endereço quando disponível', () => {
    const items = [
      {
        display_name: 'Rua Frederico Moura, Cidade Nova, Franca',
        lat: '-20.5278772',
        lon: '-47.3945179',
        class: 'highway',
        addresstype: 'road',
        boundingbox: ['-20.5291869', '-20.5266039', '-47.3959089', '-47.3931616'] as [string, string, string, string],
        address: { road: 'Rua Frederico Moura' },
      },
      {
        display_name: 'Rua Frederico Moura, 1426, Cidade Nova, Franca',
        lat: '-20.529182',
        lon: '-47.393143',
        class: 'place',
        type: 'house',
        addresstype: 'house',
        address: { road: 'Rua Frederico Moura', house_number: '1426' },
      },
    ];

    const exact = resolveCoordsFromItemsForTest(items, 'Rua Frederico Moura', 1426);
    expect(exact?.precision).toBe('exact');
    expect(exact?.latitude).toBeCloseTo(-20.529182, 5);
    expect(exact?.longitude).toBeCloseTo(-47.393143, 5);
  });
});
