/** Página real do CCO: sessão com camada Webmap ligada (F5). API mockada; dados sintéticos. */
import '@/test-utils/jsdom-global';
import { createElement, isValidElement } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

(window as unknown as { matchMedia: unknown }).matchMedia = (q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });

const api = vi.hoisted(() => ({ camadas: 0, modo: 'erro429' as 'erro429' | 'erro500' | 'ok', renders: 0 }));
vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams() }));
vi.mock('@/components/auth/require-permissions', () => ({ RequirePermissions: ({ children }: { children: unknown }) => children }));
vi.mock('@/components/layout/page-shell', () => ({ PageShell: ({ children }: { children: unknown }) => createElement('main', null, children as never) }));
vi.mock('@/components/help/tip-banner', () => ({ TipBanner: () => null }));
vi.mock('@/components/operational-map', () => ({
  OperationalMap: (p: Record<string, unknown>) => {
    api.renders += 1;
    const painel = typeof p.renderPainel === 'function' ? (p.renderPainel as (a: { fullscreenMode: boolean }) => unknown)({ fullscreenMode: false }) : null;
    return createElement('div', { 'data-testid': 'mapa' }, ...Object.values(p).filter((v) => isValidElement(v)) as never[], painel as never);
  },
}));
vi.mock('@/components/cco/chamado-mapa-list', () => ({ ChamadoMapaList: () => null }));
function erro(status: number) {
  return Object.assign(new Error(`Falha ao consultar API (${status})`), { status });
}
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
    // trava de segurança da sonda: na main o loop não termina; depois de 300 chamadas a promessa fica pendente
    if (api.camadas > 300) return new Promise(() => {});
    if (api.modo === 'ok') return Promise.resolve([{ id: 'g', titulo: 'Drenagem', camadas: [{ id: 'webmap:c1', camadaId: 'c1', nomeOriginal: 'Rede QA', geometriaTipo: 'LINE', estilo: {}, totalElementos: 1, versaoAtual: 'v1', ligadaPorPadrao: false, pesada: false }] }]);
    return Promise.reject(erro(api.modo === 'erro429' ? 429 : 500));
  },
}));

import CcoPage from '@/app/(authenticated)/cco/page';

const flush = async (ms = 0) => act(async () => { await vi.advanceTimersByTimeAsync(ms); for (let i = 0; i < 10; i++) await Promise.resolve(); });

beforeEach(() => {
  api.camadas = 0; api.renders = 0;
  window.sessionStorage.setItem('sigma.cco.camadas.v1', JSON.stringify({ ligadas: ['sigma:chamados', 'webmap:c1'], gruposAbertos: ['sigma'] }));
  vi.useFakeTimers();
});
afterEach(() => { cleanup(); vi.useRealTimers(); window.sessionStorage.clear(); });

for (const modo of ['erro429', 'erro500'] as const) {
  describe(`QA64 · página CCO com Webmap ligada na sessão (F5) e /mapa/camadas → ${modo}`, () => {
    it('C1/C2: uma chamada só ao longo de 120 s sem clique; abrir/trocar a aba não repete; "Tentar novamente" faz exatamente +1', async () => {
      api.modo = modo;
      await act(async () => { render(createElement(CcoPage)); });
      await flush();
      const linha: string[] = [];
      for (const t of [0, 1000, 5000, 30000, 60000, 120000]) {
        if (t) await flush(t - (Number(linha.at(-1)?.split('=')[0]) || 0));
        linha.push(`${t}=${api.camadas}`);
      }
      console.log(`[QA64 ${modo}] chamadas GET /mapa/camadas por t(ms): ${linha.join(' ')} · renders do mapa=${api.renders}`);
      expect(api.camadas).toBe(1);

      // abrir o painel Camadas (garantir) depois do erro: não deve disparar
      fireEvent.click(screen.getByRole('button', { name: /^Camadas/ }));
      await flush(5000);
      console.log(`[QA64 ${modo}] após abrir a aba Camadas: ${api.camadas}`);
      expect(api.camadas).toBe(1);

      // expandir a seção Webmap QGIS (recolhida por padrão)
      fireEvent.click(screen.getByRole('button', { name: /Webmap QGIS/ }));
      await flush(5000);
      console.log(`[QA64 ${modo}] após expandir Webmap QGIS: ${api.camadas}`);
      expect(api.camadas).toBe(1);

      // C3: detalhe real junto da mensagem genérica
      const alerta = screen.getByTestId('cco-camadas-erro');
      console.log(`[QA64 ${modo}] alerta: ${JSON.stringify(alerta.textContent)}`);
      expect(alerta.textContent).toContain('Não foi possível carregar as camadas do Webmap.');
      expect(screen.getByTestId('cco-camadas-erro-detalhe').textContent).toBe(`Falha ao consultar API (${modo === 'erro429' ? 429 : 500})`);

      // Tentar novamente → +1, e depois do novo erro, de novo parado
      fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
      await flush();
      const aposClique = api.camadas;
      await flush(60000);
      console.log(`[QA64 ${modo}] após 1 clique: ${aposClique}; 60 s depois: ${api.camadas}`);
      expect(aposClique).toBe(2);
      expect(api.camadas).toBe(2);

      // recuperação: API volta e o clique carrega a árvore; sem novas chamadas depois
      api.modo = 'ok';
      fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
      await flush(30000);
      console.log(`[QA64 ${modo}] após recuperação: ${api.camadas}`);
      expect(api.camadas).toBe(3);
      expect(screen.queryByTestId('cco-camadas-erro')).toBeNull();
    });
  });
}
