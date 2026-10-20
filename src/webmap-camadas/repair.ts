import polygonClipping from 'polygon-clipping';

/** 296 — validação e correção de geometria (equivalente prático ao ST_MakeValid para polígonos). */
export type Reparo =
  | { status: 'ok'; geometria: { type: string; coordinates: unknown } }
  | { status: 'corrigida'; geometria: { type: string; coordinates: unknown }; motivo: string }
  | { status: 'invalida'; motivo: string };

type Pos = number[];
const isPos = (p: unknown): p is Pos =>
  Array.isArray(p) && p.length >= 2 && Number.isFinite(p[0]) && Number.isFinite(p[1]) && Math.abs(p[0] as number) <= 180 && Math.abs(p[1] as number) <= 90;

function limparLinha(c: unknown): { pts: Pos[]; mudou: boolean } {
  if (!Array.isArray(c)) return { pts: [], mudou: true };
  const pts: Pos[] = [];
  let mudou = false;
  for (const p of c) {
    if (!isPos(p)) { mudou = true; continue; }
    const q = [p[0], p[1]];
    if (p.length !== 2) mudou = true;
    const last = pts[pts.length - 1];
    if (last && last[0] === q[0] && last[1] === q[1]) { mudou = true; continue; }
    pts.push(q);
  }
  return { pts, mudou };
}

function colinear(r: Pos[]) {
  const [a, b] = [r[0], r.find((p) => p[0] !== r[0][0] || p[1] !== r[0][1])];
  if (!b) return true;
  return r.every((p) => (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]) === 0);
}

function fecharAnel(c: unknown): { ring: Pos[] | null; mudou: boolean } {
  const { pts, mudou } = limparLinha(c);
  let changed = mudou;
  if (pts.length && (pts[0][0] !== pts[pts.length - 1][0] || pts[0][1] !== pts[pts.length - 1][1])) {
    pts.push([...pts[0]]);
    changed = true;
  }
  if (pts.length < 4 || colinear(pts)) return { ring: null, mudou: true };
  return { ring: pts, mudou: changed };
}

function segIntersect(a: Pos, b: Pos, c: Pos, d: Pos) {
  const o = (p: Pos, q: Pos, r: Pos) => Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]));
  return o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0;
}

/** Detecta auto-interseção de anel (força bruta com pré-filtro por bbox; anéis grandes vão direto ao reparo). */
function anelAutoIntersecta(r: Pos[]): boolean {
  const n = r.length - 1;
  if (n > 3000) return true;
  for (let i = 0; i < n; i++) {
    const a = r[i], b = r[i + 1];
    const minx = Math.min(a[0], b[0]), maxx = Math.max(a[0], b[0]), miny = Math.min(a[1], b[1]), maxy = Math.max(a[1], b[1]);
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue;
      const c = r[j], d = r[j + 1];
      if (Math.max(c[0], d[0]) < minx || Math.min(c[0], d[0]) > maxx || Math.max(c[1], d[1]) < miny || Math.min(c[1], d[1]) > maxy) continue;
      if (segIntersect(a, b, c, d)) return true;
    }
  }
  return false;
}

function repararPoligonos(polys: unknown[], tipo: 'Polygon' | 'MultiPolygon'): Reparo {
  const limpos: Pos[][][] = [];
  let mudou = false;
  let suspeito = false;
  for (const poly of polys) {
    if (!Array.isArray(poly) || !poly.length) { mudou = true; continue; }
    const outer = fecharAnel(poly[0]);
    if (!outer.ring) { mudou = true; continue; }
    const rings = [outer.ring];
    if (outer.mudou) mudou = true;
    for (const h of poly.slice(1)) {
      const hr = fecharAnel(h);
      if (!hr.ring) { mudou = true; continue; }
      if (hr.mudou) mudou = true;
      rings.push(hr.ring);
    }
    if (rings.some(anelAutoIntersecta)) suspeito = true;
    limpos.push(rings);
  }
  if (!limpos.length) return { status: 'invalida', motivo: 'Polígono vazio ou sem anel válido' };
  if (suspeito || (limpos.length > 1 && mudou)) {
    try {
      const out = polygonClipping.union(...(limpos as unknown as [polygonClipping.Polygon]));
      if (!out.length) return { status: 'invalida', motivo: 'Polígono degenerado (área zero após correção)' };
      return { status: 'corrigida', motivo: suspeito ? 'Auto-interseção corrigida' : 'Anéis corrigidos', geometria: out.length === 1 ? { type: 'Polygon', coordinates: out[0] } : { type: 'MultiPolygon', coordinates: out } };
    } catch (error) {
      return { status: 'invalida', motivo: `Polígono irreparável (${error instanceof Error ? error.message : String(error)})` };
    }
  }
  if (!mudou) return { status: 'ok', geometria: { type: tipo, coordinates: tipo === 'Polygon' ? limpos[0] : limpos } };
  return { status: 'corrigida', motivo: 'Anel aberto, pontos repetidos ou anel degenerado corrigidos', geometria: limpos.length === 1 ? { type: 'Polygon', coordinates: limpos[0] } : { type: 'MultiPolygon', coordinates: limpos } };
}

export function repararGeometria(g: { type?: string; coordinates?: unknown } | null | undefined): Reparo {
  if (!g || typeof g.type !== 'string') return { status: 'invalida', motivo: 'Elemento sem geometria' };
  const c = g.coordinates;
  switch (g.type) {
    case 'Point':
      return isPos(c) ? { status: 'ok', geometria: { type: 'Point', coordinates: c } } : { status: 'invalida', motivo: 'Coordenadas inválidas ou incompletas (Point)' };
    case 'MultiPoint': {
      const { pts, mudou } = limparLinha(c);
      if (!pts.length) return { status: 'invalida', motivo: 'MultiPoint vazio' };
      return mudou ? { status: 'corrigida', motivo: 'Pontos inválidos removidos', geometria: { type: 'MultiPoint', coordinates: pts } } : { status: 'ok', geometria: { type: g.type, coordinates: c } };
    }
    case 'LineString': {
      const { pts, mudou } = limparLinha(c);
      if (pts.length < 2) return { status: 'invalida', motivo: 'Linha com menos de 2 pontos' };
      return mudou ? { status: 'corrigida', motivo: 'Pontos inválidos ou repetidos removidos', geometria: { type: 'LineString', coordinates: pts } } : { status: 'ok', geometria: { type: g.type, coordinates: c } };
    }
    case 'MultiLineString': {
      if (!Array.isArray(c)) return { status: 'invalida', motivo: 'MultiLineString sem coordenadas' };
      let mudou = false;
      const lines = c.map((l) => limparLinha(l)).filter((l) => { if (l.mudou) mudou = true; if (l.pts.length < 2) { mudou = true; return false; } return true; }).map((l) => l.pts);
      if (!lines.length) return { status: 'invalida', motivo: 'Linha vazia ou com menos de 2 pontos' };
      return mudou ? { status: 'corrigida', motivo: 'Trechos inválidos removidos', geometria: { type: 'MultiLineString', coordinates: lines } } : { status: 'ok', geometria: { type: g.type, coordinates: c } };
    }
    case 'Polygon':
      if (!Array.isArray(c)) return { status: 'invalida', motivo: 'Polígono sem coordenadas' };
      return repararPoligonos([c], 'Polygon');
    case 'MultiPolygon':
      if (!Array.isArray(c)) return { status: 'invalida', motivo: 'MultiPolygon sem coordenadas' };
      return repararPoligonos(c, 'MultiPolygon');
    default:
      return { status: 'invalida', motivo: `Tipo de geometria não suportado: ${g.type}` };
  }
}
