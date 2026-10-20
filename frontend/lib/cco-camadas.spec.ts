import { describe, expect, it } from 'vitest';
import {
  CCO_CAMADAS_STORAGE_KEY, SIGMA_CAMADA_CHAMADOS, SIGMA_CAMADA_PROPRIOS, alternarCamada, alternarGrupoAberto,
  camadaLigada, contarCamadasAlemDoPadrao, desligarTodas, desligarWebmap, estadoCamadasPadrao, lerCamadasSessao, resumoGrupo,
  salvarCamadasSessao, webmapLigadas,
} from './cco-camadas';
import type { MapaCamadaGrupo } from './types';

class MemStorage {
  private m = new Map<string, string>();
  get length() { return this.m.size; }
  clear() { this.m.clear(); }
  getItem(k: string) { return this.m.has(k) ? this.m.get(k)! : null; }
  key(i: number) { return [...this.m.keys()][i] ?? null; }
  removeItem(k: string) { this.m.delete(k); }
  setItem(k: string, v: string) { this.m.set(k, String(v)); }
}
const novaSessao = () => new MemStorage() as unknown as Storage;
const cam = (id: string, nome: string) => ({ id: `webmap:${id}`, camadaId: id, nomeOriginal: nome, geometriaTipo: 'Point', estilo: null, totalElementos: 1, bbox: null, versaoAtual: 1, ligadaPorPadrao: false as const, pesada: false });
const arvore: MapaCamadaGrupo[] = [{ id: 'g1', titulo: 'Drenagem', camadas: [cam('a', 'Bocas de lobo'), cam('b', 'Galerias')] }];

describe('299 · camadas do CCO (D-296c)', () => {
  it('padrão: SIGMA ligado, nenhuma camada do Webmap ligada', () => {
    const e = estadoCamadasPadrao();
    expect(camadaLigada(e, SIGMA_CAMADA_PROPRIOS)).toBe(true);
    expect(camadaLigada(e, SIGMA_CAMADA_CHAMADOS)).toBe(true);
    expect(webmapLigadas(e)).toEqual([]);
    expect(contarCamadasAlemDoPadrao(e)).toBe(0);
  });

  it('sessão nova (vazia ou inválida) volta ao padrão desligado', () => {
    expect(lerCamadasSessao(novaSessao())).toEqual(estadoCamadasPadrao());
    const s = novaSessao();
    s.setItem(CCO_CAMADAS_STORAGE_KEY, '{lixo');
    expect(lerCamadasSessao(s)).toEqual(estadoCamadasPadrao());
    s.setItem(CCO_CAMADAS_STORAGE_KEY, JSON.stringify({ ligadas: 'x' }));
    expect(lerCamadasSessao(s)).toEqual(estadoCamadasPadrao());
    expect(lerCamadasSessao(null)).toEqual(estadoCamadasPadrao());
  });

  it('escolha persiste na mesma sessão e não vaza para outra', () => {
    const sessao = novaSessao();
    const e = alternarGrupoAberto(alternarCamada(estadoCamadasPadrao(), 'webmap:a'), 'webmap-grupo:g1');
    salvarCamadasSessao(e, sessao);
    const relida = lerCamadasSessao(sessao);
    expect(webmapLigadas(relida)).toEqual(['webmap:a']);
    expect(relida.gruposAbertos).toContain('webmap-grupo:g1');
    expect(webmapLigadas(lerCamadasSessao(novaSessao()))).toEqual([]);
  });

  it('ids estranhos são descartados', () => {
    const s = novaSessao();
    s.setItem(CCO_CAMADAS_STORAGE_KEY, JSON.stringify({ ligadas: ['webmap:a', 'http://x', 'webmap:a'] }));
    expect(lerCamadasSessao(s).ligadas).toEqual(['webmap:a']);
  });

  it('alternar, "N de M ligadas", desligar todas e lista para a 298', () => {
    let e = alternarCamada(estadoCamadasPadrao(), 'webmap:b', true);
    e = alternarCamada(e, 'webmap:a', true);
    e = alternarCamada(e, 'webmap:a', true);
    expect(resumoGrupo(e, arvore[0]).texto).toBe('2 de 2 ligadas');
    expect(webmapLigadas(e)).toEqual(['webmap:b', 'webmap:a']);
    expect(webmapLigadas(alternarCamada(e, 'webmap:zz', true), arvore)).toEqual(['webmap:b', 'webmap:a']);
    expect(contarCamadasAlemDoPadrao(e, true)).toBe(3);
    const off = desligarTodas(e);
    expect(resumoGrupo(off, arvore[0]).texto).toBe('0 de 2 ligadas');
    expect(contarCamadasAlemDoPadrao(off)).toBe(2);
    const soWebmap = desligarWebmap(e);
    expect(webmapLigadas(soWebmap)).toEqual([]);
    expect(camadaLigada(soWebmap, SIGMA_CAMADA_PROPRIOS)).toBe(true);
  });
});
