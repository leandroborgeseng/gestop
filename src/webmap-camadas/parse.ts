import { nomeBase } from './normalize';
import { repararGeometria } from './repair';
import { FeatureStreamSplitter } from './stream';

export type GeometriaFamilia = 'POINT' | 'LINE' | 'POLYGON';
export type CamadaDeclarada = { variavel: string; titulo: string; grupo: string; ordem: number; grupoOrdem: number };

/** Lê layers/layers.js (qgis2web/OpenLayers) sem eval: camadas vetoriais, grupos (1 nível) e ordem. */
export function parseLayersJs(content: string): { grupos: Array<{ titulo: string; ordem: number }>; camadas: CamadaDeclarada[] } {
  const titulos = new Map<string, string>();
  const lyrRe = /var\s+lyr_(\w+)\s*=\s*new\s+ol\.layer\.Vector\(\{([\s\S]*?)\}\);/g;
  for (const m of content.matchAll(lyrRe)) {
    const body = m[2];
    const popup = /popuplayertitle:\s*'((?:[^'\\]|\\.)*)'/.exec(body)?.[1];
    const title = /title:\s*'((?:[^'\\]|\\.)*)'/.exec(body.replace(/popuplayertitle:[^\n]*/, ''))?.[1];
    titulos.set(m[1], (popup ?? title ?? m[1]).replace(/<[^>]*>/g, '').replace(/\\'/g, "'").trim());
  }
  const grupoDe = new Map<string, { var: string; titulo: string; layers: string[] }>();
  const grpRe = /var\s+group_(\w+)\s*=\s*new\s+ol\.layer\.Group\(\{\s*layers:\s*\[([^\]]*)\][\s\S]*?title:\s*'((?:[^'\\]|\\.)*)'\s*\}\)/g;
  for (const m of content.matchAll(grpRe)) {
    grupoDe.set(m[1], { var: m[1], titulo: m[3], layers: [...m[2].matchAll(/lyr_(\w+)/g)].map((x) => x[1]) });
  }
  const listMatch = /var\s+layersList\s*=\s*\[([^\]]*)\]/.exec(content);
  const ordemTopo = listMatch ? listMatch[1].split(',').map((s) => s.trim()).filter(Boolean) : [];
  const grupos: Array<{ titulo: string; ordem: number }> = [];
  const camadas: CamadaDeclarada[] = [];
  const usados = new Set<string>();
  ordemTopo.forEach((ref, gi) => {
    const g = ref.startsWith('group_') ? grupoDe.get(ref.slice(6)) : null;
    if (g) {
      grupos.push({ titulo: g.titulo, ordem: gi });
      g.layers.forEach((v, li) => {
        if (!titulos.has(v)) return;
        usados.add(v);
        camadas.push({ variavel: v, titulo: titulos.get(v)!, grupo: g.titulo, ordem: li, grupoOrdem: gi });
      });
    } else if (ref.startsWith('lyr_') && titulos.has(ref.slice(4))) {
      const v = ref.slice(4);
      usados.add(v);
      if (!grupos.some((x) => x.titulo === '(SEM GRUPO)')) grupos.push({ titulo: '(SEM GRUPO)', ordem: gi });
      camadas.push({ variavel: v, titulo: titulos.get(v)!, grupo: '(SEM GRUPO)', ordem: gi, grupoOrdem: gi });
    }
  });
  return { grupos, camadas };
}

export type ElementoLido = {
  fidOrigem: string | null;
  geometriaTipo: string;
  familia: GeometriaFamilia | null;
  /** Para geometriaInvalida = true: a geometria original como veio (pode ser null). */
  geometria: { type: string; coordinates: unknown } | null;
  geometriaOriginal: unknown | null;
  corrigida: boolean;
  motivoCorrecao: string | null;
  atributos: Record<string, unknown>;
  /** null só quando a geometria inválida não tem nenhuma coordenada aproveitável. */
  bbox: [number, number, number, number] | null;
  /** TL: feição sem conserto é gravada com a geometria original e não é desenhada no mapa. */
  geometriaInvalida: boolean;
};
export type ErroLeitura = { grupo?: string; camada: string; elemento: string | null; motivo: string };

export const FAMILIA: Record<string, GeometriaFamilia> = {
  Point: 'POINT', MultiPoint: 'POINT', LineString: 'LINE', MultiLineString: 'LINE', Polygon: 'POLYGON', MultiPolygon: 'POLYGON',
};

function bboxOf(c: unknown, acc = [Infinity, Infinity, -Infinity, -Infinity]): number[] {
  if (Array.isArray(c) && typeof c[0] === 'number') {
    acc[0] = Math.min(acc[0], c[0]); acc[1] = Math.min(acc[1], c[1] as number); acc[2] = Math.max(acc[2], c[0]); acc[3] = Math.max(acc[3], c[1] as number);
  } else if (Array.isArray(c)) for (const x of c) bboxOf(x, acc);
  return acc;
}

/**
 * Valida/corrige uma feature já parseada. Sempre devolve o elemento a gravar; quando não há conserto,
 * o elemento leva a geometria original com geometriaInvalida = true e vem junto o erro (CSV / PARCIAL).
 */
export function processarFeature(raw: unknown, index: number, label: string, grupo?: string): { elemento: ElementoLido; erro?: ErroLeitura } {
  const f = raw as { properties?: Record<string, unknown> | null; geometry?: { type?: string; coordinates?: unknown } | null };
  const props = (f && typeof f.properties === 'object' && f.properties) || {};
  const fid = props.fid != null ? String(props.fid) : null;
  const ref = fid ?? `#${index + 1}`;
  const r = repararGeometria(f?.geometry);
  if (r.status === 'invalida') {
    const g = f?.geometry && typeof f.geometry === 'object' ? (f.geometry as { type: string; coordinates: unknown }) : null;
    const b = g ? bboxOf(g.coordinates) : null;
    const bbox = b && b.every(Number.isFinite) ? (b as [number, number, number, number]) : null;
    return {
      elemento: {
        fidOrigem: fid, geometriaTipo: typeof g?.type === 'string' ? g.type : 'DESCONHECIDO', familia: (g && FAMILIA[g.type]) || null, geometria: g,
        geometriaOriginal: null, corrigida: false, motivoCorrecao: null, atributos: props, bbox, geometriaInvalida: true,
      },
      erro: { grupo, camada: label, elemento: ref, motivo: r.motivo },
    };
  }
  const familia = FAMILIA[r.geometria.type];
  const bbox = bboxOf(r.geometria.coordinates) as [number, number, number, number];
  return {
    elemento: {
      fidOrigem: fid, geometriaTipo: r.geometria.type, familia, geometria: r.geometria,
      geometriaOriginal: r.status === 'corrigida' ? f.geometry ?? null : null, corrigida: r.status === 'corrigida', motivoCorrecao: r.status === 'corrigida' ? r.motivo : null,
      atributos: props, bbox, geometriaInvalida: false,
    },
  };
}

/** Extrai o objeto JSON de `var json_X = {...};` (usado só em testes/arquivos pequenos). */
export function extractLayerJson(content: string, label: string): { features?: unknown[] } {
  const start = content.indexOf('{');
  const end = content.lastIndexOf('}');
  if (start < 0 || end < start) throw new Error(`Camada ${label}: conteúdo sem GeoJSON`);
  try {
    const parsed = JSON.parse(content.slice(start, end + 1)) as { features?: unknown[] };
    if (!Array.isArray(parsed.features)) throw new Error('sem features');
    return parsed;
  } catch (error) {
    throw new Error(`Camada ${label}: GeoJSON inválido (${error instanceof Error ? error.message : String(error)})`);
  }
}

export function readFeatures(content: string, label: string): { elementos: ElementoLido[]; erros: ErroLeitura[] } {
  const elementos: ElementoLido[] = [];
  const erros: ErroLeitura[] = [];
  (extractLayerJson(content, label).features ?? []).forEach((raw, i) => {
    const r = processarFeature(raw, i, label);
    if (r.erro) erros.push(r.erro);
    if (!r.elemento.geometriaInvalida) elementos.push(r.elemento);
  });
  return { elementos, erros };
}

/** Leitura em fluxo: chama onElemento/onErro por feature. Lança se o GeoJSON da camada for ilegível. */
export async function lerElementosStream(
  chunks: AsyncIterable<string>, label: string, grupo: string | undefined,
  onElemento: (e: ElementoLido) => Promise<void> | void, onErro: (e: ErroLeitura) => void,
) {
  let index = 0;
  const pend: unknown[] = [];
  const splitter = new FeatureStreamSplitter((json) => {
    pend.push(JSON.parse(json));
  });
  try {
    for await (const chunk of chunks) {
      splitter.push(chunk);
      while (pend.length) {
        const r = processarFeature(pend.shift(), index++, label, grupo);
        if (r.erro) onErro(r.erro);
        await onElemento(r.elemento);
      }
      if (splitter.terminou) break;
    }
    splitter.end();
  } catch (error) {
    throw new Error(`Camada ${label}: GeoJSON inválido (${error instanceof Error ? error.message : String(error)})`);
  }
}

export type EstiloNormalizado = {
  tipo: 'circle' | 'icon' | 'line' | 'fill' | 'desconhecido';
  cor: string | null;
  largura: number | null;
  preenchimento: string | null;
  raio: number | null;
  icone: { origem: string; url?: string; sha256?: string } | null;
  tracejado: number[] | null;
  categorias?: Array<{ valor: string; cor: string | null; preenchimento: string | null }>;
  atributoCategoria?: string | null;
};

function firstStyle(block: string): Omit<EstiloNormalizado, 'categorias' | 'atributoCategoria'> {
  const stroke = /new ol\.style\.Stroke\(\{([^}]*)\}/.exec(block)?.[1] ?? '';
  const fill = /new ol\.style\.Fill\(\{\s*color:\s*'([^']+)'/.exec(block)?.[1] ?? null;
  const cor = /color:\s*'([^']+)'/.exec(stroke)?.[1] ?? null;
  const largura = Number(/width:\s*([\d.]+)/.exec(stroke)?.[1] ?? NaN);
  const dash = /lineDash:\s*\[([^\]]*)\]/.exec(stroke)?.[1];
  const circle = /new ol\.style\.Circle\(\{\s*radius:\s*([\d.]+)/.exec(block);
  const icon = /new ol\.style\.Icon\(\{[\s\S]*?src:\s*'([^']+)'/.exec(block);
  const tipo = icon ? 'icon' : circle ? 'circle' : fill ? 'fill' : cor ? 'line' : 'desconhecido';
  return {
    tipo, cor, preenchimento: fill, largura: Number.isFinite(largura) ? largura : null,
    raio: circle ? Number(circle[1]) : null, icone: icon ? { origem: icon[1] } : null,
    tracejado: dash ? dash.split(',').map(Number).filter(Number.isFinite) : null,
  };
}

/** Normaliza o estilo qgis2web (cor, símbolo, largura, preenchimento); categorias simples por atributo. */
export function parseStyle(content: string | null): EstiloNormalizado {
  if (!content) return { tipo: 'desconhecido', cor: null, largura: null, preenchimento: null, raio: null, icone: null, tracejado: null };
  const base = firstStyle(content);
  const attr = /var value = feature\.get\("([^"]*)"\)/.exec(content)?.[1] || null;
  const categorias: EstiloNormalizado['categorias'] = [];
  const caseRe = /case\s+'((?:[^'\\]|\\.)*)':([\s\S]*?)break;/g;
  for (const m of content.matchAll(caseRe)) {
    const s = firstStyle(m[2]);
    categorias.push({ valor: m[1], cor: s.cor, preenchimento: s.preenchimento });
  }
  return categorias.length ? { ...base, categorias, atributoCategoria: attr } : base;
}

export function nomeBaseCamada(c: CamadaDeclarada) {
  return nomeBase(c.titulo, c.variavel);
}
