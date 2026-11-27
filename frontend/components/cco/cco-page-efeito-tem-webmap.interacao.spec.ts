/**
 * Isola o efeito temWebmapLigada da página: o hook é o da main (garantir instável,
 * sem checar erro). Se o efeito voltar a depender de garantirArvoreCamadas, o teste fica vermelho.
 */
import '@/test-utils/jsdom-global';
import { createElement, isValidElement } from 'react';
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

(window as unknown as { matchMedia: unknown }).matchMedia = (q: string) => ({
  matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {},
});

const api = vi.hoisted(() => ({ camadas: 0 }));
vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams() }));
vi.mock('@/components/auth/require-permissions', () => ({ RequirePermissions: ({ children }: { children: unknown }) => children }));
vi.mock('@/components/layout/page-shell', () => ({ PageShell: ({ children }: { children: unknown }) => createElement('main', null, children as never) }));
vi.mock('@/components/help/tip-banner', () => ({ TipBanner: () => null }));
vi.mock('@/components/operational-map', () => ({
  OperationalMap: (p: Record<string, unknown>) => {
    const painel = typeof p.renderPainel === 'function' ? (p.renderPainel as (a: { fullscreenMode: boolean }) => unknown)({ fullscreenMode: false }) : null;
    return createElement('div', { 'data-testid': 'mapa' }, ...Object.values(p).filter((v) => isValidElement(v)) as never[], painel as never);
  },
}));
vi.mock('@/components/cco/chamado-mapa-list', () => ({ ChamadoMapaList: () => null }));
vi.mock('@/lib/api', () => ({
  getResumoOperacional: () => Promise.resolve({ totalUnidades: 0, totalPendencias: 0 }),
  getOpcoesFiltroUnidades: () => Promise.resolve({ secretarias: [], bairros: [], tipos: [], regioes: [], responsaveis: [], categoriasVistoria: [], equipes: [], tiposChamado: [] }),
  getUnidades: () => Promise.resolve([]),
  listTiposProprioDisponiveis: () => Promise.resolve([]),
  listTiposChamadoDisponiveisProprios: () => Promise.resolve([]),
  listChamadosMapa: () => Promise.resolve({ items: [], total: 0, truncado: false }),
  getMapaCamadaGeojson: () => new Promise(() => {}),
  getMapaCamadas: () => {
    api.camadas += 1;
    if (api.camadas > 300) return new Promise(() => {});
    return Promise.reject(Object.assign(new Error('Falha ao consultar API (429)'), { status: 429 }));
  },
}));

vi.mock('@/lib/use-arvore-camadas-webmap', async () => {
  const react = await import('react');
  const { getMapaCamadas } = await import('@/lib/api');
  return {
    useArvoreCamadasWebmap: () => {
      const [arvore, setArvore] = react.useState<unknown[] | null>(null);
      const [carregando, setCarregando] = react.useState(false);
      const [erro, setErro] = react.useState(false);
      const [erroMensagem, setErroMensagem] = react.useState<string | null>(null);
      const [semAcesso, setSemAcesso] = react.useState(false);
      const carregar = react.useCallback(() => {
        setCarregando(true);
        setErro(false);
        setErroMensagem(null);
        setSemAcesso(false);
        getMapaCamadas()
          .then((data) => setArvore(Array.isArray(data) ? data : []))
          .catch((e: unknown) => {
            if ((e as { status?: number } | null)?.status === 403) setSemAcesso(true);
            else {
              setErro(true);
              setErroMensagem(e instanceof Error ? e.message : 'erro');
            }
          })
          .finally(() => setCarregando(false));
      }, []);
      // Identidade instável, como o garantir da main: muda quando erro/carregando mudam e não checa erro.
      const garantir = react.useCallback(() => {
        if (!arvore && !carregando && !semAcesso) carregar();
      }, [arvore, carregando, semAcesso, carregar]);
      return { arvore, carregando, erro, erroMensagem, semAcesso, carregar, garantir };
    },
  };
});

import CcoPage from '@/app/(authenticated)/cco/page';

const flush = async (ms = 0) =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
    for (let i = 0; i < 10; i++) await Promise.resolve();
  });

beforeEach(() => {
  api.camadas = 0;
  window.sessionStorage.setItem(
    'sigma.cco.camadas.v1',
    JSON.stringify({ ligadas: ['sigma:chamados', 'webmap:c1'], gruposAbertos: ['sigma'] }),
  );
  vi.useFakeTimers();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  window.sessionStorage.clear();
});

describe('CCO · efeito temWebmapLigada isolado do hook', () => {
  it('com garantir instável (main), o efeito da página não rearma: 1 chamada em 120 s', async () => {
    await act(async () => {
      render(createElement(CcoPage));
    });
    await flush();
    for (const t of [1000, 5000, 30000, 60000, 120000]) await flush(t);
    expect(api.camadas).toBe(1);
  });
});
