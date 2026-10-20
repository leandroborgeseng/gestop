/**
 * 298 — Camadas do Webmap no mapa do CCO: lógica pura (sem Leaflet) para testar sem navegador.
 * - Tiles: camada pesada é buscada por tiles no zoom tz = floor(z) − 2 (1 a ~4 tiles por vista), simplificação no zoom floor(z).
 * - Cache: LRU por bytes (desktop 40 MB, celular 15 MB), chave camada@versão|z|tz/x/y (pesada) ou camada@versão|all (leve).
 * - Gerenciador: liga/desliga, debounce de 300 ms no mover, AbortController por requisição, status por camada.
 */
import type { MapaCamada } from '@/lib/types';

export type Bounds = [number, number, number, number]; // [oeste, sul, leste, norte] em graus (EPSG:4326)
export type Vista = { bounds: Bounds; zoom: number };
export type FeicaoWebmap = { type: 'Feature'; id: string; fid?: string | null; geometry: { type: string; coordinates: unknown }; properties: Record<string, unknown> | null };
export type RespostaGeojson = { versao: string | number | null; truncado: boolean; total: number; features: FeicaoWebmap[] };
export type Requisicao = { chave: string; bbox?: Bounds; zoom?: number };
export type StatusCamadaWebmap =
  | { estado: 'carregando' }
  | { estado: 'ok'; truncado: boolean }
  | { estado: 'erro' }
  | { estado: 'fora_zoom'; minZoom?: number; maxZoom?: number };

export const DEBOUNCE_MS = 300;
export const MAX_TILES_POR_VISTA = Number(process.env.WEBMAP_MAX_TILES ?? 12);
/** tz = floor(z) − DESLOC_TILE: 1 => tiles de 512 px de tela. */
export const DESLOC_TILE = Number(process.env.WEBMAP_DESLOC_TILE ?? 1);
export const CACHE_BYTES_DESKTOP = 40 * 1024 * 1024;
export const CACHE_BYTES_CELULAR = 15 * 1024 * 1024;

export class VersaoMudouError extends Error {
  constructor() { super('versao_mudou'); }
}

// ── tiles (slippy map, Web Mercator) ────────────────────────────────────────────────────────────
const lng2x = (lng: number, z: number) => Math.floor(((lng + 180) / 360) * 2 ** z);
const lat2y = (lat: number, z: number) => {
  const r = (Math.max(-85.0511, Math.min(85.0511, lat)) * Math.PI) / 180;
  return Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z);
};
const x2lng = (x: number, z: number) => (x / 2 ** z) * 360 - 180;
const y2lat = (y: number, z: number) => (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / 2 ** z))) * 180) / Math.PI;
const arred = (n: number) => Math.round(n * 1e7) / 1e7;

export function tileBounds(z: number, x: number, y: number): Bounds {
  return [arred(x2lng(x, z)), arred(y2lat(y + 1, z)), arred(x2lng(x + 1, z)), arred(y2lat(y, z))];
}

/** Tiles que cobrem a vista. tz = floor(zoom) − 2; se passar de MAX_TILES_POR_VISTA, sobe um nível (tiles maiores). */
export function tilesDaVista(v: Vista): Array<{ z: number; x: number; y: number }> {
  const [w, s, e, n] = v.bounds;
  let tz = Math.max(0, Math.floor(v.zoom) - DESLOC_TILE);
  for (;;) {
    const x0 = lng2x(w, tz), x1 = lng2x(e, tz), y0 = lat2y(n, tz), y1 = lat2y(s, tz);
    const max = 2 ** tz - 1;
    const xs = [Math.max(0, x0), Math.min(max, x1)], ys = [Math.max(0, y0), Math.min(max, y1)];
    const total = (xs[1] - xs[0] + 1) * (ys[1] - ys[0] + 1);
    if (total <= MAX_TILES_POR_VISTA || tz === 0) {
      const out: Array<{ z: number; x: number; y: number }> = [];
      for (let x = xs[0]; x <= xs[1]; x++) for (let y = ys[0]; y <= ys[1]; y++) out.push({ z: tz, x, y });
      return out;
    }
    tz -= 1;
  }
}

/** Faixa de zoom da origem (qgis2web), se a importação trouxer `estilo.minZoom`/`estilo.maxZoom`. */
export function faixaZoom(c: MapaCamada): { minZoom?: number; maxZoom?: number } {
  const e = (c.estilo ?? {}) as Record<string, unknown>;
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);
  return { minZoom: num(e.minZoom), maxZoom: num(e.maxZoom) };
}
export function foraDaFaixa(c: MapaCamada, zoom: number) {
  const { minZoom, maxZoom } = faixaZoom(c);
  return (minZoom !== undefined && zoom < minZoom) || (maxZoom !== undefined && zoom > maxZoom);
}

export function requisicoesDaCamada(c: MapaCamada, v: Vista): Requisicao[] {
  const base = `${c.camadaId}@${c.versaoAtual ?? ''}`;
  if (!c.pesada) return [{ chave: `${base}|all` }];
  const z = Math.floor(v.zoom);
  return tilesDaVista(v).map((t) => ({ chave: `${base}|${z}|${t.z}/${t.x}/${t.y}`, bbox: tileBounds(t.z, t.x, t.y), zoom: z }));
}

// ── cache LRU por bytes ─────────────────────────────────────────────────────────────────────────
export class CacheLru<T> {
  private mapa = new Map<string, { valor: T; bytes: number }>();
  private total = 0;
  constructor(readonly maxBytes: number) {}
  get bytes() { return this.total; }
  get tamanho() { return this.mapa.size; }
  get(chave: string): T | undefined {
    const e = this.mapa.get(chave);
    if (!e) return undefined;
    this.mapa.delete(chave);
    this.mapa.set(chave, e);
    return e.valor;
  }
  has(chave: string) { return this.mapa.has(chave); }
  set(chave: string, valor: T, bytes: number) {
    const antigo = this.mapa.get(chave);
    if (antigo) { this.total -= antigo.bytes; this.mapa.delete(chave); }
    if (bytes > this.maxBytes) return;
    this.mapa.set(chave, { valor, bytes });
    this.total += bytes;
    for (const [k, e] of this.mapa) {
      if (this.total <= this.maxBytes) break;
      this.mapa.delete(k);
      this.total -= e.bytes;
    }
  }
  limpar() { this.mapa.clear(); this.total = 0; }
}

export function limiteCacheBytes(w: { matchMedia?: (q: string) => { matches: boolean }; navigator?: { deviceMemory?: number } } | undefined = typeof window !== 'undefined' ? (window as never) : undefined) {
  const celular = Boolean(w?.matchMedia?.('(max-width: 599px)').matches) || (w?.navigator?.deviceMemory ?? 8) <= 4;
  return celular ? CACHE_BYTES_CELULAR : CACHE_BYTES_DESKTOP;
}

// ── balão somente leitura ───────────────────────────────────────────────────────────────────────
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
/** Atributos com rótulos originais; vazios (null, '', só espaços) e internos (_*) omitidos. */
export function atributosVisiveis(props: Record<string, unknown> | null | undefined): Array<[string, string]> {
  return Object.entries(props ?? {})
    .filter(([k, v]) => !k.startsWith('_') && v !== null && v !== undefined && String(v).trim() !== '')
    .map(([k, v]) => [k, typeof v === 'object' ? JSON.stringify(v) : String(v)]);
}
export function htmlBalao(nomeCamada: string, props: Record<string, unknown> | null | undefined) {
  const linhas = atributosVisiveis(props).map(([k, v]) => `<tr><th scope="row">${esc(k)}</th><td>${esc(v)}</td></tr>`).join('');
  return `<div class="webmap-balao" role="dialog" aria-label="${esc(nomeCamada)}"><strong>${esc(nomeCamada)}</strong>${linhas ? `<table>${linhas}</table>` : ''}</div>`;
}

// ── gerenciador ─────────────────────────────────────────────────────────────────────────────────
export type Desenho = {
  mostrar: (camada: MapaCamada, feicoes: FeicaoWebmap[]) => void;
  remover: (camadaId: string) => void;
};
export type Buscar = (c: MapaCamada, r: Requisicao, signal: AbortSignal) => Promise<{ dados: RespostaGeojson; bytes: number }>;
type Agendador = { set: (fn: () => void, ms: number) => unknown; clear: (h: unknown) => void };

export class WebmapGerenciador {
  private camadas = new Map<string, MapaCamada>();
  private vista: Vista | null = null;
  private pendentes = new Map<string, AbortController>(); // chave → controller
  private falhas = new Set<string>();
  private debounce: unknown = null;
  private status = new Map<string, StatusCamadaWebmap>();
  private desenhado = new Map<string, string>(); // camadaId → assinatura do que está desenhado
  readonly cache: CacheLru<RespostaGeojson>;
  /** Medição/testes: total de requisições disparadas. */
  requisicoes = 0;

  constructor(private readonly o: {
    buscar: Buscar; desenho: Desenho; onStatus?: (s: Record<string, StatusCamadaWebmap>) => void; onVersaoMudou?: () => void;
    cacheBytes?: number; debounceMs?: number; agendador?: Agendador;
  }) {
    this.cache = new CacheLru(o.cacheBytes ?? CACHE_BYTES_DESKTOP);
  }

  private get ag(): Agendador {
    return this.o.agendador ?? { set: (fn, ms) => setTimeout(fn, ms), clear: (h) => clearTimeout(h as ReturnType<typeof setTimeout>) };
  }

  /** Camadas ligadas (e existentes na lista). Ligar busca na hora; desligar remove e cancela na hora. */
  setCamadas(lista: MapaCamada[]) {
    const novas = new Map(lista.map((c) => [c.camadaId, c]));
    for (const [id, antiga] of this.camadas) {
      const nova = novas.get(id);
      if (!nova || String(nova.versaoAtual) !== String(antiga.versaoAtual)) this.desligar(id, Boolean(nova));
    }
    this.camadas = novas;
    this.sincronizar();
  }

  /** Movimento do mapa: debounce (≥ 300 ms) antes de buscar. */
  setVista(v: Vista, imediato = false) {
    this.vista = v;
    if (this.debounce) this.ag.clear(this.debounce);
    if (imediato) { this.debounce = null; this.sincronizar(); return; }
    this.debounce = this.ag.set(() => { this.debounce = null; this.sincronizar(); }, this.o.debounceMs ?? DEBOUNCE_MS);
  }

  tentarNovamente(camadaId: string) {
    for (const k of [...this.falhas]) if (k.startsWith(`${camadaId}@`)) this.falhas.delete(k);
    this.sincronizar();
  }

  dispose() {
    if (this.debounce) this.ag.clear(this.debounce);
    for (const id of [...this.camadas.keys()]) this.desligar(id, false);
    this.camadas.clear();
    this.cache.limpar();
  }

  private desligar(camadaId: string, manterStatus: boolean) {
    for (const [k, ctrl] of this.pendentes) if (k.startsWith(`${camadaId}@`)) { ctrl.abort(); this.pendentes.delete(k); }
    for (const k of [...this.falhas]) if (k.startsWith(`${camadaId}@`)) this.falhas.delete(k);
    this.o.desenho.remover(camadaId);
    this.desenhado.delete(camadaId);
    if (!manterStatus) this.status.delete(camadaId);
  }

  private emitir() {
    this.o.onStatus?.(Object.fromEntries(this.status));
  }

  private sincronizar() {
    const v = this.vista;
    if (!v) return;
    const necessarias = new Set<string>();
    for (const c of this.camadas.values()) {
      if (foraDaFaixa(c, v.zoom)) {
        this.desligar(c.camadaId, true);
        const f = faixaZoom(c);
        this.status.set(c.camadaId, { estado: 'fora_zoom', ...f });
        continue;
      }
      const reqs = requisicoesDaCamada(c, v);
      for (const r of reqs) {
        necessarias.add(r.chave);
        if (this.cache.has(r.chave) || this.pendentes.has(r.chave) || this.falhas.has(r.chave)) continue;
        this.disparar(c, r);
      }
      this.redesenhar(c, reqs);
    }
    // requisições que saíram da vista (ou de camada desligada) são canceladas
    for (const [k, ctrl] of this.pendentes) if (!necessarias.has(k)) { ctrl.abort(); this.pendentes.delete(k); }
    this.emitir();
  }

  private disparar(c: MapaCamada, r: Requisicao) {
    const ctrl = new AbortController();
    this.pendentes.set(r.chave, ctrl);
    this.requisicoes += 1;
    this.o.buscar(c, r, ctrl.signal).then(
      ({ dados, bytes }) => {
        if (ctrl.signal.aborted) return;
        this.pendentes.delete(r.chave);
        this.cache.set(r.chave, dados, bytes);
        this.posResposta(c.camadaId);
      },
      (err: unknown) => {
        if (ctrl.signal.aborted) return;
        this.pendentes.delete(r.chave);
        if (err instanceof VersaoMudouError) { this.o.onVersaoMudou?.(); return; }
        this.falhas.add(r.chave);
        this.posResposta(c.camadaId);
      },
    );
  }

  private posResposta(camadaId: string) {
    const c = this.camadas.get(camadaId);
    if (!c || !this.vista) return;
    this.redesenhar(c, requisicoesDaCamada(c, this.vista));
    this.emitir();
  }

  private redesenhar(c: MapaCamada, reqs: Requisicao[]) {
    const prontas = reqs.filter((r) => this.cache.has(r.chave));
    const carregando = reqs.some((r) => this.pendentes.has(r.chave));
    const erro = reqs.some((r) => this.falhas.has(r.chave));
    const assinatura = prontas.map((r) => r.chave).join(',');
    if (prontas.length && this.desenhado.get(c.camadaId) !== assinatura) {
      const vistos = new Set<string>();
      const feicoes: FeicaoWebmap[] = [];
      for (const r of prontas) for (const f of this.cache.get(r.chave)!.features) {
        if (vistos.has(f.id)) continue; // feição que cruza tiles: uma vez só
        vistos.add(f.id);
        feicoes.push(f);
      }
      this.o.desenho.mostrar(c, feicoes);
      this.desenhado.set(c.camadaId, assinatura);
    } else if (!prontas.length && this.desenhado.has(c.camadaId) && !carregando) {
      this.o.desenho.remover(c.camadaId);
      this.desenhado.delete(c.camadaId);
    }
    const truncado = prontas.some((r) => this.cache.get(r.chave)!.truncado);
    this.status.set(c.camadaId, erro ? { estado: 'erro' } : carregando ? { estado: 'carregando' } : { estado: 'ok', truncado });
  }
}
