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

/** Acima disto não se TENTA a união (polygon-clipping usa recursão/memória proporcionais). Só vale para polígono inválido. */
export const MAX_VERTICES_REPARO = 20_000;

/**
 * Detecta auto-interseção de anel com grade espacial (memória O(n), sem montar estruturas grandes).
 * Segmentos adjacentes (que compartilham vértice) não contam.
 */
export function anelAutoIntersecta(r: Pos[]): boolean | 'indeterminado' {
  const n = r.length - 1;
  if (n < 4) return false;
  let minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity;
  for (const p of r) { if (p[0] < minx) minx = p[0]; if (p[0] > maxx) maxx = p[0]; if (p[1] < miny) miny = p[1]; if (p[1] > maxy) maxy = p[1]; }
  const lado = Math.max(1, Math.ceil(Math.sqrt(n)));
  const cw = (maxx - minx) / lado || 1, ch = (maxy - miny) / lado || 1;
  const grade = new Map<number, number[]>();
  const marca = new Int32Array(n).fill(-1);
  let orcamento = 1_000_000; // comparações; acima disso (anel patológico) o resultado é 'indeterminado'
  const cel = (v: number, min: number, w: number) => Math.min(lado - 1, Math.floor((v - min) / w));
  for (let i = 0; i < n; i++) {
    const a = r[i], b = r[i + 1];
    const x0 = cel(Math.min(a[0], b[0]), minx, cw), x1 = cel(Math.max(a[0], b[0]), minx, cw);
    const y0 = cel(Math.min(a[1], b[1]), miny, ch), y1 = cel(Math.max(a[1], b[1]), miny, ch);
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) {
      const k = x * lado + y;
      let lst = grade.get(k);
      if (!lst) grade.set(k, (lst = []));
      for (const j of lst) {
        if (marca[j] === i) continue;
        marca[j] = i;
        if (--orcamento < 0) return 'indeterminado';
        if (j === i - 1 || (j === 0 && i === n - 1)) continue;
        if (segIntersect(a, b, r[j], r[j + 1])) return true;
      }
      lst.push(i);
    }
  }
  return false;
}

function uniao(rings: Pos[][]): Pos[][][] {
  return polygonClipping.union(rings as unknown as polygonClipping.Polygon) as unknown as Pos[][][];
}

/** Corrige cada polígono separadamente (memória limitada ao maior polígono, não à feature inteira). */
function repararPoligonos(polys: unknown[], tipo: 'Polygon' | 'MultiPolygon'): Reparo {
  const out: Pos[][][] = [];
  let mudou = false;
  let autoIntersecao = false;
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
    const checks = rings.map(anelAutoIntersecta);
    const intersecta = checks.includes(true);
    const indeterminado = !intersecta && checks.includes('indeterminado');
    if (!intersecta && !indeterminado) { out.push(rings); continue; }
    const vertices = rings.reduce((t, x) => t + x.length, 0);
    if (vertices > MAX_VERTICES_REPARO) {
      // TL: o limite só bloqueia a TENTATIVA de reparo. Sem prova de invalidez, a feição grande entra como veio.
      if (indeterminado) { out.push(rings); continue; }
      return { status: 'invalida', motivo: `Polígono irreparável: auto-interseção em polígono acima de ${MAX_VERTICES_REPARO} vértices (${vertices}); reparo não tentado` };
    }
    let partes: Pos[][][];
    try {
      partes = uniao(rings);
    } catch (error) {
      return { status: 'invalida', motivo: `Polígono irreparável (${error instanceof Error ? error.message : String(error)})` };
    }
    autoIntersecao = true;
    out.push(...partes);
  }
  if (!out.length) return { status: 'invalida', motivo: autoIntersecao ? 'Polígono degenerado (área zero após correção)' : 'Polígono vazio ou sem anel válido' };
  const geometria = out.length === 1 ? { type: 'Polygon', coordinates: out[0] } : { type: 'MultiPolygon', coordinates: out };
  if (autoIntersecao) return { status: 'corrigida', motivo: 'Auto-interseção corrigida', geometria };
  if (!mudou) return { status: 'ok', geometria: { type: tipo, coordinates: tipo === 'Polygon' ? out[0] : out } };
  return { status: 'corrigida', motivo: 'Anel aberto, pontos repetidos ou anel degenerado corrigidos', geometria };
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
