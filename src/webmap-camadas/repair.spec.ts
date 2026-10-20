import { describe, expect, it } from 'vitest';
import { repararGeometria } from './repair';
import { FeatureStreamSplitter } from './stream';

describe('296 — correção de geometria (sem PostGIS)', () => {
  it('polígono válido fica como está', () => {
    expect(repararGeometria({ type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] }).status).toBe('ok');
  });
  it('anel aberto é fechado (corrigida)', () => {
    const r = repararGeometria({ type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1]]] });
    expect(r).toMatchObject({ status: 'corrigida', geometria: { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]] } });
  });
  it('auto-interseção (gravata) vira MultiPolygon válido', () => {
    const r = repararGeometria({ type: 'Polygon', coordinates: [[[0, 0], [2, 2], [2, 0], [0, 2], [0, 0]]] });
    expect(r).toMatchObject({ status: 'corrigida', motivo: 'Auto-interseção corrigida', geometria: { type: 'MultiPolygon' } });
  });
  it('polígono vazio ou de área zero é irreparável', () => {
    expect(repararGeometria({ type: 'Polygon', coordinates: [] })).toMatchObject({ status: 'invalida' });
    expect(repararGeometria({ type: 'Polygon', coordinates: [[[0, 0], [1, 1], [2, 2], [0, 0]]] })).toMatchObject({ status: 'invalida' });
    expect(repararGeometria(null)).toMatchObject({ status: 'invalida', motivo: 'Elemento sem geometria' });
  });
  it('leitura em fluxo separa features mesmo quebradas entre pedaços', () => {
    const txt = 'var json_X = {"type":"FeatureCollection","features":[{"type":"Feature","properties":{"a":"}{]["},"geometry":{"type":"Point","coordinates":[1,2]}},{"type":"Feature","properties":{},"geometry":null}]};';
    const got: string[] = [];
    const s = new FeatureStreamSplitter((j) => got.push(j));
    for (let i = 0; i < txt.length; i += 7) s.push(txt.slice(i, i + 7));
    s.end();
    expect(got.map((g) => JSON.parse(g).properties)).toEqual([{ a: '}{][' }, {}]);
    const t = new FeatureStreamSplitter(() => undefined);
    t.push(txt.slice(0, 80));
    expect(() => t.end()).toThrow(/truncado/);
  });
});
