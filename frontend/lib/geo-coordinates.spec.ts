import { describe, expect, it } from 'vitest';
import { hasPlottableCoordinates, parseGeoCoordinate, toLatLngTuple } from './geo-coordinates';

describe('geo-coordinates', () => {
  it('aceita numeros e strings numericas', () => {
    expect(parseGeoCoordinate('-20.53936')).toBe(-20.53936);
    expect(hasPlottableCoordinates({ latitude: -20.53936, longitude: -47.40081 })).toBe(true);
  });

  it('rejeita null, vazio e NaN', () => {
    expect(parseGeoCoordinate(null)).toBeNull();
    expect(parseGeoCoordinate('')).toBeNull();
    expect(parseGeoCoordinate('abc')).toBeNull();
    expect(hasPlottableCoordinates({ latitude: null, longitude: -47.4 })).toBe(false);
  });

  it('converte para tupla lat/lng', () => {
    expect(toLatLngTuple({ latitude: -20.53936, longitude: -47.40081 })).toEqual([
      -20.53936,
      -47.40081,
    ]);
  });
});
