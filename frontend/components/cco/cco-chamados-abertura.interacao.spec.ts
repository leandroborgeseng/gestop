/** 295 · CCO › Todos os chamados: Data de abertura, debounce, resposta atrasada, total real e faixa de corte. */
import '@/test-utils/jsdom-global';
import { createElement } from 'react';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

(window as unknown as { matchMedia: unknown }).matchMedia = (q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });

type Resp = { items: Array<{ id: string }>; total: number; truncado: boolean };
const api = vi.hoisted(() => ({
  chamadas: [] as Array<Record<string, unknown>>,
  pendentes: [] as Array<{ resolve: (r: Resp) => void; filtros: Record<string, unknown> }>,
}));
vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams() }));
vi.mock('@/components/auth/require-permissions', () => ({ RequirePermissions: ({ children }: { children: unknown }) => children }));
vi.mock('@/components/layout/page-shell', () => ({ PageShell: ({ children }: { children: unknown }) => createElement('main', null, children as never) }));
vi.mock('@/components/help/tip-banner', () => ({ TipBanner: () => null }));
vi.mock('@/components/operational-map', () => ({
  OperationalMap: (p: { chamados: unknown[]; notaCorte?: string }) =>
    createElement('div', { 'data-testid': 'mapa', 'data-n': p.chamados.length }, p.notaCorte ?? ''),
}));
vi.mock('@/components/cco/chamado-mapa-list', () => ({
  ChamadoMapaList: (p: { chamados: Array<{ titulo: string }> }) =>
    createElement('ul', { 'data-testid': 'lista' }, p.chamados.slice(0, 20).map((c, i) => createElement('li', { key: i }, c.titulo))),
}));
vi.mock('@/lib/api', () => ({
  getResumoOperacional: () => Promise.resolve({ totalUnidades: 0, totalPendencias: 0 }),
  getOpcoesFiltroUnidades: () => Promise.resolve({ secretarias: [], bairros: [], tipos: [], regioes: [], responsaveis: [], categoriasVistoria: [], equipes: [], tiposChamado: [] }),
  getUnidades: () => Promise.resolve([]),
  listChamadosMapa: (filtros: Record<string, unknown>) => {
    api.chamadas.push(JSON.parse(JSON.stringify(filtros)));
    return new Promise<Resp>((resolve) => api.pendentes.push({ resolve, filtros }));
  },
}));

import CcoPage from '@/app/(authenticated)/cco/page';
import { CHAMADO_STATUS_NAO_FINALIZADOS } from '@/lib/chamado-status';

const itens = (n: number, p = 'c') => Array.from({ length: n }, (_, i) => ({
  id: `${p}${i}`, codigo: `${p}${i}`, titulo: `T${i}`, status: 'ABERTO', prioridade: 'MEDIA', origem: 'INTERNO', createdAt: '2026-10-01T12:00:00Z',
  mapaLatitude: null, mapaLongitude: null, slaMapa: null, secretaria: { id: 's1', nome: 'Obras', sigla: 'SO' }, unidade: null, equipe: null, tipoChamado: null, responsavel: null,
}));
const tick = async (ms = 0) => act(async () => { vi.advanceTimersByTime(ms); for (let i = 0; i < 5; i++) await Promise.resolve(); });

async function abrirChamados() {
  render(createElement(CcoPage));
  await tick();
  fireEvent.click(screen.getByRole('button', { name: 'Todos os chamados' }));
  await tick(300);
}
function abrirSanfona() {
  const cab = screen.getAllByRole('button').find((b) => b.getAttribute('aria-expanded') === 'false' && b.textContent?.includes('Filtros de chamados'));
  if (cab) fireEvent.click(cab);
}
const resumo = () => screen.getByTestId('cco-filtros-resumo').textContent;

beforeEach(() => {
  api.chamadas.length = 0;
  api.pendentes.length = 0;
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('295 · CCO › Todos os chamados', () => {
  it('padrão Não finalizados; rápido vai como abertura e o resumo mostra o período antes do status', async () => {
    await abrirChamados();
    expect(api.chamadas).toEqual([{ status: [...CHAMADO_STATUS_NAO_FINALIZADOS], abertura: {} }]);
    abrirSanfona();
    fireEvent.click(within(screen.getByRole('group', { name: 'Tempo desde a abertura' })).getByRole('button', { name: 'Há mais de 30 dias' }));
    await tick(300);
    expect(api.chamadas.at(-1)).toMatchObject({ status: [...CHAMADO_STATUS_NAO_FINALIZADOS], abertura: { rapido: 30 } });
    fireEvent.click(screen.getAllByRole('button').find((b) => b.getAttribute('aria-expanded') === 'true')!);
    expect(resumo()).toMatch(/^Abertos há mais de 30 dias · /);
  });
  it('busca: debounce (uma consulta ao parar de digitar)', async () => {
    await abrirChamados();
    abrirSanfona();
    const n = api.chamadas.length;
    const busca = screen.getByPlaceholderText('Código, título ou endereço');
    for (const t of ['l', 'la', 'lam', 'lamp']) {
      fireEvent.change(busca, { target: { value: t } });
      await tick(100);
    }
    expect(api.chamadas.length).toBe(n);
    await tick(300);
    expect(api.chamadas.length).toBe(n + 1);
    expect(api.chamadas.at(-1)!.search).toBe('lamp');
  });
  it('resposta atrasada não sobrescreve a mais nova', async () => {
    await abrirChamados();
    abrirSanfona();
    const primeira = api.pendentes.at(-1)!;
    fireEvent.change(screen.getByPlaceholderText('Código, título ou endereço'), { target: { value: 'x' } });
    await tick(300);
    const segunda = api.pendentes.at(-1)!;
    await act(async () => segunda.resolve({ items: itens(2, 'novo'), total: 2, truncado: false }));
    await act(async () => primeira.resolve({ items: itens(9, 'velho'), total: 9, truncado: false }));
    expect(screen.getByTestId('mapa').getAttribute('data-n')).toBe('2');
    expect(screen.queryByText('T8')).toBeNull();
  });
  it('mais de 2.000: total real no contador, faixa role=status com o texto, nota no mapa; some quando cabe', async () => {
    await abrirChamados();
    await act(async () => api.pendentes.at(-1)!.resolve({ items: itens(2000), total: 12345, truncado: true }));
    const faixa = screen.getByTestId('aviso-cortados');
    expect(faixa.getAttribute('role')).toBe('status');
    expect(faixa.textContent).toContain('Mostrando 2.000 de 12.345 chamados. Refine os filtros para ver todos no mapa.');
    expect(faixa.className).toContain('bg-[var(--warn-bg)]');
    expect(faixa.className).toContain('text-[var(--warn-ink)]');
    expect(within(faixa).queryByRole('button', { name: /fechar/i })).toBeNull();
    expect(screen.getByTestId('aviso-cortados-mapa').getAttribute('aria-hidden')).toBe('true');
    expect(screen.getByTestId('mapa').textContent).toBe('Mapa com os 2.000 primeiros');
    expect(screen.getAllByText('12345').length).toBeGreaterThan(0);
    // Ajustar filtros abre a sanfona e foca o primeiro campo do período
    const ajustar = within(faixa).getByRole('button', { name: 'Ajustar filtros' });
    expect(ajustar.className).toContain('min-h-11');
    fireEvent.click(ajustar);
    await tick(1);
    expect(document.activeElement).toBe(screen.getByLabelText('Data inicial'));
    fireEvent.change(screen.getByPlaceholderText('Código, título ou endereço'), { target: { value: 'y' } });
    await tick(300);
    await act(async () => api.pendentes.at(-1)!.resolve({ items: itens(5), total: 5, truncado: false }));
    expect(screen.queryByTestId('aviso-cortados')).toBeNull();
    expect(screen.getByTestId('mapa').textContent).toBe('');
  });
  it('Limpar filtros remove o período e volta a Não finalizados', async () => {
    await abrirChamados();
    abrirSanfona();
    fireEvent.click(within(screen.getByRole('group', { name: 'Tempo desde a abertura' })).getByRole('button', { name: 'Há mais de 90 dias' }));
    fireEvent.click(screen.getByRole('button', { name: 'Finalizados' }));
    await tick(300);
    fireEvent.click(screen.getAllByRole('button', { name: 'Limpar' })[0]);
    await tick(300);
    expect(api.chamadas.at(-1)).toEqual({ status: [...CHAMADO_STATUS_NAO_FINALIZADOS], abertura: {} });
    expect((screen.getByLabelText('Data final') as HTMLInputElement).value).toBe('');
  });
});
