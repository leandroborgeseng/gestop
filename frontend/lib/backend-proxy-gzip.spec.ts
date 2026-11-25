import { describe, expect, it } from 'vitest';
import { deveComprimirCamadas } from './backend-proxy';

describe('298 · gzip só no mapa de camadas', () => {
  it('lista e GeoJSON do mapa com Accept-Encoding gzip', () => {
    expect(deveComprimirCamadas('mapa/camadas', 'gzip, deflate, br', 200, 300_000)).toBe(true);
    expect(deveComprimirCamadas('mapa/camadas/abc/geojson', 'gzip', 200, 2_000_000)).toBe(true);
  });
  it('não comprime outras rotas, erro, corpo pequeno ou cliente sem gzip', () => {
    expect(deveComprimirCamadas('chamados', 'gzip', 200, 300_000)).toBe(false);
    expect(deveComprimirCamadas('admin/importacao/webmap-camadas/status', 'gzip', 200, 300_000)).toBe(false);
    expect(deveComprimirCamadas('mapa/camadas', 'gzip', 409, 300_000)).toBe(false);
    expect(deveComprimirCamadas('mapa/camadas', 'gzip', 200, 500)).toBe(false);
    expect(deveComprimirCamadas('mapa/camadas', 'br', 200, 300_000)).toBe(false);
    expect(deveComprimirCamadas('mapa/camadas', null, 200, 300_000)).toBe(false);
  });
});
