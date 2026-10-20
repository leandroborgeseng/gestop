import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MAX_VERTICES_REPARO, repararGeometria } from './repair';
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
  it('polígono real que estoura a pilha do polygon-clipping vira "irreparável" sem lançar', () => {
    const f = JSON.parse(readFileSync(join(__dirname, '../../test/fixtures/webmap-camadas/pilha/poligono-estouro-pilha.json'), 'utf8'));
    const r = repararGeometria(f.geometry);
    expect(r).toMatchObject({ status: 'invalida' });
    expect((r as { motivo: string }).motivo).toMatch(/^Polígono irreparável/);
  });

  it('polígono VÁLIDO acima de 20 mil vértices nunca vira erro (o limite só bloqueia a tentativa de reparo)', () => {
    const n = MAX_VERTICES_REPARO * 2;
    const ring = Array.from({ length: n }, (_, i) => { const a = (i / n) * Math.PI * 2; return [-47.4 + Math.cos(a) * 0.1, -20.5 + Math.sin(a) * 0.1]; });
    ring.push(ring[0]);
    const r = repararGeometria({ type: 'Polygon', coordinates: [ring] });
    expect(r.status).toBe('ok');
  });

  it('auto-interseção num polígono acima do limite de vértices não roda a união (erro, sem estourar memória)', () => {
    const n = MAX_VERTICES_REPARO + 10;
    const ring = Array.from({ length: n }, (_, i) => { const a = (i / n) * Math.PI * 2; return [Math.cos(a), Math.sin(a)]; });
    ring.push([1.2, 0.0], [-1.2, 0.01]);
    ring.push(ring[0]);
    const r = repararGeometria({ type: 'Polygon', coordinates: [ring] });
    expect(r).toMatchObject({ status: 'invalida' });
    expect((r as { motivo: string }).motivo).toMatch(/reparo não tentado/);
  });
});
