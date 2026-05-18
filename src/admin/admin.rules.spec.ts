import { describe, expect, it } from 'vitest';
import { ensureGeoCoordinates, isValidLatitude, isValidLongitude, normalizeEmail, normalizeSigla } from './admin.rules';

describe('regras administrativas', () => {
  it('normaliza sigla e email antes de persistir', () => {
    expect(normalizeSigla(' sme ')).toBe('SME');
    expect(normalizeEmail(' ADMIN@FRANCA.SP.GOV.BR ')).toBe('admin@franca.sp.gov.br');
  });

  it('valida faixas de latitude e longitude', () => {
    expect(isValidLatitude(-20.53)).toBe(true);
    expect(isValidLatitude(-91)).toBe(false);
    expect(isValidLongitude(-47.4)).toBe(true);
    expect(isValidLongitude(181)).toBe(false);
  });

  it('bloqueia coordenadas invalidas para proprios publicos', () => {
    expect(() => ensureGeoCoordinates(-20.53, -47.4)).not.toThrow();
    expect(() => ensureGeoCoordinates(-120, -47.4)).toThrow('Coordenadas geograficas invalidas');
  });
});
