/** 295 · Chamados › Triagem: Data de abertura no servidor, página volta a 1, contadores, Limpar filtros, resposta atrasada. */
import '@/test-utils/jsdom-global';
import { createElement } from 'react';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

(window as unknown as { matchMedia: unknown }).matchMedia = (q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });

type Resp = { items: unknown[]; total: number; limit: number; offset: number; hasMore: boolean; statusCounts: Record<string, number>; hasSemSla: boolean };
const api = vi.hoisted(() => ({ chamadas: [] as Array<Record<string, unknown>>, pendentes: [] as Array<(r: Resp) => void> }));
vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams(), useRouter: () => ({ push() {}, replace() {} }), usePathname: () => '/chamados' }));
vi.mock('@/components/auth/require-permissions', () => ({ RequirePermissions: ({ children }: { children: unknown }) => children }));
vi.mock('@/components/layout/page-shell', () => ({ PageShell: ({ children }: { children: unknown }) => createElement('main', null, children as never) }));
vi.mock('@/components/help/tip-banner', () => ({ TipBanner: () => null }));
vi.mock('@/components/auth/session-context', () => ({ useSessionUser: () => ({ id: 'u1', permissoes: [], perfis: [] }) }));
vi.mock('@/components/ui/snackbar', () => ({ useSnackbar: () => ({ show() {} }) }));
vi.mock('@/lib/use-safe-back-href', () => ({ useSafeBackHref: () => '/cco' }));
vi.mock('@/lib/api', () => ({
  listChamados: (q: Record<string, unknown>) => {
    api.chamadas.push(q);
    return new Promise<Resp>((resolve) => api.pendentes.push(resolve));
  },
  listChamadoEquipes: () => Promise.resolve([]),
  listTiposChamadoOpcoes: () => Promise.resolve([]),
  getSecretarias: () => Promise.resolve([]),
  getChamado: () => new Promise(() => {}),
  listTarefasDoChamado: () => new Promise(() => {}),
}));

import ChamadosPage from '@/app/(authenticated)/chamados/page';

const resp = (total: number, counts: Record<string, number>): Resp => ({ items: [], total, limit: 50, offset: 0, hasMore: false, statusCounts: counts, hasSemSla: false });
const tick = async (ms = 0) => act(async () => { vi.advanceTimersByTime(ms); for (let i = 0; i < 5; i++) await Promise.resolve(); });
const grupo = () => screen.getByRole('group', { name: 'Tempo desde a abertura' });

beforeEach(() => {
  api.chamadas.length = 0;
  api.pendentes.length = 0;
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('295 · Triagem', () => {
  it('grupo Data de abertura logo depois de Status; rápido vai ao servidor só como diasMinimos e a página volta a 1', async () => {
    render(createElement(ChamadosPage));
    await tick(250);
    expect(api.chamadas.at(-1)).toMatchObject({ offset: 0 });
    expect(api.chamadas.at(-1)).not.toHaveProperty('diasMinimos', expect.anything());
    const titulos = [...document.querySelectorAll('p')].map((p) => p.textContent).filter((t) => t === 'Status' || t === 'Data de abertura' || t === 'Prioridade');
    expect(titulos).toEqual(['Status', 'Data de abertura', 'Prioridade']);
    fireEvent.click(within(grupo()).getByRole('button', { name: 'Há mais de 30 dias' }));
    await tick(250);
    const q = api.chamadas.at(-1)!;
    expect(q.diasMinimos).toBe('30');
    expect(q).not.toHaveProperty('abertoAte', expect.anything());
    expect(q.offset).toBe(0);
  });
  it('período manual vai como abertoDe/abertoAte; contadores por status vêm da resposta (com o período)', async () => {
    render(createElement(ChamadosPage));
    await tick(250);
    await act(async () => api.pendentes.at(-1)!(resp(10, { TODOS: 10, ABERTO: 10 })));
    fireEvent.change(screen.getByLabelText('Data inicial'), { target: { value: '2026-09-01' } });
    fireEvent.change(screen.getByLabelText('Data final'), { target: { value: '2026-09-30' } });
    await tick(400);
    await tick(250);
    expect(api.chamadas.at(-1)).toMatchObject({ abertoDe: '2026-09-01', abertoAte: '2026-09-30', offset: 0 });
    await act(async () => api.pendentes.at(-1)!(resp(3, { TODOS: 3, ABERTO: 2, EM_EXECUCAO: 1 })));
    const status = screen.getAllByRole('button').filter((b) => b.textContent?.startsWith('Aberto'));
    expect(status[0].textContent).toContain('2');
  });
  it('inicial > final: mensagem e nenhuma consulta nova', async () => {
    render(createElement(ChamadosPage));
    await tick(250);
    const n = api.chamadas.length;
    fireEvent.change(screen.getByLabelText('Data final'), { target: { value: '2026-09-01' } });
    fireEvent.change(screen.getByLabelText('Data inicial'), { target: { value: '2026-09-30' } });
    await tick(2000);
    expect(screen.getByRole('alert').textContent).toBe('A data inicial não pode ser posterior à data final.');
    expect(api.chamadas.length).toBe(n + 0);
  });
  it('resposta atrasada não sobrescreve a mais nova', async () => {
    render(createElement(ChamadosPage));
    await tick(250);
    const velha = api.pendentes.at(-1)!;
    fireEvent.click(within(grupo()).getByRole('button', { name: 'Há mais de 60 dias' }));
    await tick(250);
    const nova = api.pendentes.at(-1)!;
    await act(async () => nova(resp(4, { TODOS: 4, ABERTO: 4 })));
    await act(async () => velha(resp(99, { TODOS: 99, ABERTO: 99 })));
    const todos = screen.getAllByRole('button').find((b) => b.textContent?.startsWith('Todos') && b.textContent !== 'Todos')!;
    expect(todos.textContent).toContain('4');
    expect(todos.textContent).not.toContain('99');
  });
  it('"Limpar filtros" (novo na Triagem) remove o período e volta ao padrão', async () => {
    render(createElement(ChamadosPage));
    await tick(250);
    fireEvent.click(within(grupo()).getByRole('button', { name: 'Há mais de 180 dias' }));
    await tick(250);
    fireEvent.click(screen.getByRole('button', { name: 'Limpar filtros' }));
    await tick(250);
    const q = api.chamadas.at(-1)!;
    expect(q.diasMinimos).toBeUndefined();
    expect(within(grupo()).getByRole('button', { name: 'Todos' }).getAttribute('aria-pressed')).toBe('true');
    expect((screen.getByLabelText('Data final') as HTMLInputElement).value).toBe('');
  });
  it('resumo recolhido mostra o período antes dos demais filtros', async () => {
    render(createElement(ChamadosPage));
    await tick(250);
    fireEvent.change(screen.getByLabelText('Data inicial'), { target: { value: '2026-10-01' } });
    await tick(400);
    const cab = screen.getByRole('button', { name: /Filtros de chamados/ });
    fireEvent.click(cab);
    expect(cab.querySelectorAll('p')[1].textContent).toBe('Abertos a partir de 01/10/2026');
  });
});
