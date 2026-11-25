import { describe, expect, it, vi } from 'vitest';
import type { MapaCamada } from '@/lib/types';
import {
  CacheLru, CACHE_BYTES_CELULAR, CACHE_BYTES_DESKTOP, DEBOUNCE_MS, htmlBalao, limiteCacheBytes, MAX_TILES_POR_VISTA, requisicoesDaCamada,
  tileBounds, tilesDaVista, type FeicaoWebmap, type Requisicao, VersaoMudouError, type Vista, WebmapGerenciador,
} from './webmap-mapa';

const camada = (over: Partial<MapaCamada> = {}): MapaCamada => ({
  id: 'webmap:c1', camadaId: 'c1', nomeOriginal: 'Rede de água', geometriaTipo: 'LINE', estilo: {}, totalElementos: 69419, bbox: null, versaoAtual: 'v1', ligadaPorPadrao: false, pesada: true, ...over,
});
const BAIRRO: Vista = { bounds: [-47.41, -20.545, -47.395, -20.535], zoom: 16.4 }; // ~bairro em Franca
const CIDADE: Vista = { bounds: [-47.5, -20.6, -47.3, -20.45], zoom: 13 };
const feicao = (id: string): FeicaoWebmap => ({ type: 'Feature', id, geometry: { type: 'Point', coordinates: [-47.4, -20.54] }, properties: { NOME: id } });

/** Agendador manual (debounce sem relógio real). */
function relogio() {
  let fila: Array<{ fn: () => void; h: number }> = []; let n = 0;
  return { set: (fn: () => void) => { const h = ++n; fila.push({ fn, h }); return h; }, clear: (h: unknown) => { fila = fila.filter((x) => x.h !== h); }, rodar: () => { const f = fila; fila = []; f.forEach((x) => x.fn()); }, get pendentes() { return fila.length; } };
}
function montar(opts: { falhar?: (r: Requisicao) => unknown; atraso?: boolean } = {}) {
  const chamadas: Array<{ c: MapaCamada; r: Requisicao; signal: AbortSignal; resolver: () => void; rejeitar: (e: unknown) => void }> = [];
  const desenho = { mostrar: vi.fn(), remover: vi.fn() };
  const status: Array<Record<string, unknown>> = [];
  const ag = relogio();
  const onVersaoMudou = vi.fn();
  const ger = new WebmapGerenciador({
    desenho, agendador: ag, onVersaoMudou, onStatus: (s) => status.push(s),
    buscar: (c, r, signal) => new Promise((res, rej) => {
      const resolver = () => res({ dados: { versao: c.versaoAtual, truncado: r.chave.includes('|13|'), total: 1, features: [feicao(`${r.chave}#a`), feicao('compartilhada')] }, bytes: 1000 });
      chamadas.push({ c, r, signal, resolver, rejeitar: rej });
      if (opts.falhar) { const e = opts.falhar(r); if (e) rej(e); else if (!opts.atraso) resolver(); }
      else if (!opts.atraso) resolver();
    }),
  });
  const ultimo = () => status[status.length - 1] ?? {};
  return { ger, chamadas, desenho, ag, ultimo, onVersaoMudou };
}
const flush = () => new Promise((r) => setTimeout(r, 0));

describe('298 · tiles e chaves', () => {
  it('vista de bairro pede poucos tiles (≤ 6) no zoom floor(z)−1, com bbox e zoom de simplificação', () => {
    const ts = tilesDaVista(BAIRRO);
    expect(ts.length).toBeGreaterThanOrEqual(1);
    expect(ts.length).toBeLessThanOrEqual(6);
    expect(ts.every((t) => t.z === 15)).toBe(true);
    const reqs = requisicoesDaCamada(camada(), BAIRRO);
    expect(reqs.every((r) => r.zoom === 16 && r.bbox && r.chave.startsWith('c1@v1|16|15/'))).toBe(true);
  });
  it('nunca passa de MAX_TILES_POR_VISTA (sobe o nível do tile)', () => {
    expect(tilesDaVista({ bounds: [-50, -24, -44, -18], zoom: 12 }).length).toBeLessThanOrEqual(MAX_TILES_POR_VISTA);
  });
  it('tileBounds contém o centro do tile e respeita a ordem oeste,sul,leste,norte', () => {
    const [w, s, e, n] = tileBounds(14, 6034, 9228);
    expect(w).toBeLessThan(e); expect(s).toBeLessThan(n);
  });
  it('camada leve: 1 requisição da camada inteira; chave muda com a versão (L1)', () => {
    expect(requisicoesDaCamada(camada({ pesada: false }), BAIRRO)).toEqual([{ chave: 'c1@v1|all' }]);
    expect(requisicoesDaCamada(camada({ pesada: false, versaoAtual: 'v2' }), BAIRRO)[0].chave).toBe('c1@v2|all');
  });
});

describe('298 · cache LRU por bytes', () => {
  it('descarta o menos usado ao passar do teto', () => {
    const c = new CacheLru<number>(100);
    c.set('a', 1, 40); c.set('b', 2, 40); c.get('a'); c.set('c', 3, 40);
    expect([c.has('a'), c.has('b'), c.has('c')]).toEqual([true, false, true]);
    expect(c.bytes).toBe(80);
  });
  it('limite menor no celular (≤ 599 px ou deviceMemory ≤ 4)', () => {
    expect(limiteCacheBytes({ matchMedia: () => ({ matches: false }), navigator: { deviceMemory: 8 } })).toBe(CACHE_BYTES_DESKTOP);
    expect(limiteCacheBytes({ matchMedia: () => ({ matches: true }) })).toBe(CACHE_BYTES_CELULAR);
    expect(limiteCacheBytes({ matchMedia: () => ({ matches: false }), navigator: { deviceMemory: 4 } })).toBe(CACHE_BYTES_CELULAR);
  });
});

describe('298 · gerenciador (crit. 1–7, 11)', () => {
  it('C1: sem camada ligada, nenhuma requisição', async () => {
    const { ger, chamadas } = montar();
    ger.setVista(BAIRRO, true); ger.setCamadas([]); await flush();
    expect(chamadas).toHaveLength(0);
  });

  it('C2: ligar busca só a camada ligada, na hora, com status carregando até responder', async () => {
    const { ger, chamadas, ultimo } = montar({ atraso: true });
    ger.setVista(BAIRRO, true);
    ger.setCamadas([camada()]);
    expect(chamadas.length).toBeGreaterThanOrEqual(1);
    expect(chamadas.every((c) => c.c.camadaId === 'c1' && c.r.bbox && c.r.zoom === 16)).toBe(true);
    expect(ultimo().c1).toEqual({ estado: 'carregando' });
    chamadas.forEach((c) => c.resolver()); await flush();
    expect(ultimo().c1).toEqual({ estado: 'ok', truncado: false });
  });

  it('C3: desligar remove na hora e cancela as pendentes', () => {
    const { ger, chamadas, desenho, ultimo } = montar({ atraso: true });
    ger.setVista(BAIRRO, true); ger.setCamadas([camada()]);
    ger.setCamadas([]);
    expect(chamadas.every((c) => c.signal.aborted)).toBe(true);
    expect(desenho.remover).toHaveBeenCalledWith('c1');
    expect(ultimo().c1).toBeUndefined();
  });

  it('C4: religar na mesma vista não faz nova requisição; desenha sem duplicar feição que cruza tiles', async () => {
    const { ger, chamadas, desenho } = montar();
    ger.setVista(BAIRRO, true); ger.setCamadas([camada()]); await flush();
    const n = chamadas.length;
    ger.setCamadas([]); ger.setCamadas([camada()]); await flush();
    expect(chamadas.length).toBe(n);
    const ultimas = desenho.mostrar.mock.calls.at(-1)![1] as FeicaoWebmap[];
    expect(ultimas.filter((f) => f.id === 'compartilhada')).toHaveLength(1);
  });

  it('C4/L1: versão nova da camada não usa o cache da antiga; 409 avisa para recarregar a lista', async () => {
    const { ger, chamadas, onVersaoMudou } = montar({ falhar: (r) => (r.chave.startsWith('c1@v2') ? new VersaoMudouError() : null) });
    ger.setVista(BAIRRO, true); ger.setCamadas([camada()]); await flush();
    const n = chamadas.length;
    ger.setCamadas([camada({ versaoAtual: 'v2' })]); await flush();
    expect(chamadas.length).toBeGreaterThan(n);
    expect(onVersaoMudou).toHaveBeenCalled();
  });

  it(`C5: pan/zoom com debounce de ${DEBOUNCE_MS} ms — várias movimentações = 1 lote; tiles fora da vista são cancelados`, async () => {
    const { ger, chamadas, ag } = montar({ atraso: true });
    ger.setVista(BAIRRO, true); ger.setCamadas([camada()]);
    const n = chamadas.length;
    for (let i = 0; i < 5; i++) ger.setVista({ bounds: [-47.3 - i * 0.01, -20.6, -47.29 - i * 0.01, -20.59], zoom: 16 });
    expect(chamadas.length).toBe(n); // nada antes do debounce
    expect(ag.pendentes).toBe(1);
    ag.rodar();
    expect(chamadas.length).toBeGreaterThan(n);
    expect(chamadas.slice(0, n).every((c) => c.signal.aborted)).toBe(true);
  });

  it('C6/L6: resposta truncada => status truncado (aviso "Aproxime o mapa…")', async () => {
    const { ger, ultimo } = montar();
    ger.setVista(CIDADE, true); ger.setCamadas([camada()]); await flush();
    expect(ultimo().c1).toEqual({ estado: 'ok', truncado: true });
  });

  it('C7: fora da faixa de zoom da origem => não busca, não desenha e informa "a partir do zoom N"', async () => {
    const { ger, chamadas, ultimo } = montar();
    ger.setVista(CIDADE, true); ger.setCamadas([camada({ estilo: { minZoom: 15 } })]); await flush();
    expect(chamadas).toHaveLength(0);
    expect(ultimo().c1).toEqual({ estado: 'fora_zoom', minZoom: 15, maxZoom: undefined });
    ger.setVista(BAIRRO, true); await flush();
    expect(chamadas.length).toBeGreaterThan(0);
  });

  it('C11: falha de uma camada marca só ela; Tentar novamente refaz; a outra segue desenhada', async () => {
    let quebrar = true;
    const { ger, desenho, ultimo, chamadas } = montar({ falhar: (r) => (quebrar && r.chave.startsWith('c2@') ? new Error('500') : null) });
    ger.setVista(BAIRRO, true);
    ger.setCamadas([camada(), camada({ id: 'webmap:c2', camadaId: 'c2', nomeOriginal: 'Esgoto' })]); await flush();
    expect(ultimo().c2).toEqual({ estado: 'erro' });
    expect(ultimo().c1).toEqual({ estado: 'ok', truncado: false });
    expect(desenho.mostrar.mock.calls.some((c) => (c[0] as MapaCamada).camadaId === 'c1')).toBe(true);
    const n = chamadas.length;
    quebrar = false; ger.tentarNovamente('c2'); await flush();
    expect(chamadas.length).toBeGreaterThan(n);
    expect(ultimo().c2).toEqual({ estado: 'ok', truncado: false });
  });

  it('dispose (fechar o CCO) cancela tudo e esvazia o cache', async () => {
    const { ger, chamadas } = montar({ atraso: true });
    ger.setVista(BAIRRO, true); ger.setCamadas([camada()]);
    ger.dispose();
    expect(chamadas.every((c) => c.signal.aborted)).toBe(true);
    expect(ger.cache.tamanho).toBe(0);
  });
});

describe('298 · balão somente leitura (crit. 8)', () => {
  it('rótulos originais, vazios e internos omitidos, HTML escapado; sem atributos só o nome', () => {
    const h = htmlBalao('Rede <água>', { DIAMETRO: 150, 'Material Tubo': 'PVC', VAZIO: '', NULO: null, ESP: '  ', _geometriaCorrigida: true, X: '<b>x</b>' });
    expect(h).toContain('<strong>Rede &lt;água&gt;</strong>');
    expect(h).toContain('<th scope="row">DIAMETRO</th><td>150</td>');
    expect(h).toContain('<th scope="row">Material Tubo</th><td>PVC</td>');
    expect(h).not.toMatch(/VAZIO|NULO|ESP|_geometria/);
    expect(h).toContain('&lt;b&gt;x&lt;/b&gt;');
    expect(htmlBalao('Só nome', {})).toBe('<div class="webmap-balao" role="dialog" aria-label="Só nome"><strong>Só nome</strong></div>');
  });
});
