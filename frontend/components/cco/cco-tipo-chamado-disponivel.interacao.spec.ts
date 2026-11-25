/** 316 · CCO › filtro Tipo de chamado (duas abas): opções do backend, sem o próprio tipo, poda só ele, texto vazio. */
import '@/test-utils/jsdom-global';
import { createElement, useState } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
(window as unknown as { matchMedia: unknown }).matchMedia = (q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
import type { ChamadosMapaFilters, UnidadeFilters } from '@/lib/types';

const api = vi.hoisted(() => ({
  mapa: [] as Array<Record<string, unknown>>,
  proprios: [] as Array<Record<string, unknown>>,
  respMapa: [] as Array<{ id: string; nome: string; total: number }>,
  respProprios: [] as Array<{ id: string; nome: string; total: number }>,
}));
vi.mock('@/lib/api', () => ({
  listTiposProprioDisponiveis: () => Promise.resolve([]),
  listTiposChamadoDisponiveisMapa: (f: Record<string, unknown>) => { api.mapa.push(JSON.parse(JSON.stringify(f))); return Promise.resolve(api.respMapa); },
  listTiposChamadoDisponiveisProprios: (f: Record<string, unknown>) => { api.proprios.push(JSON.parse(JSON.stringify(f))); return Promise.resolve(api.respProprios); },
}));
const { CcoFiltrosPanel } = await import('./cco-filtros-panel');

const OPCOES = { secretarias: [], bairros: [], tipos: [], regioes: [], responsaveis: [], categoriasVistoria: [], equipes: [],
  tiposChamado: [{ id: 't1', nome: 'Iluminação' }, { id: 't2', nome: 'Poda' }, { id: 't3', nome: 'Buraco' }] };
const tick = async (ms = 0) => act(async () => { vi.advanceTimersByTime(ms); for (let i = 0; i < 5; i++) await Promise.resolve(); });
const estado: { chamado?: ChamadosMapaFilters; proprios?: UnidadeFilters } = {};

function Harness(p: { tab: 'proprios' | 'chamados'; chamado?: ChamadosMapaFilters; proprios?: UnidadeFilters; variante?: 'sanfona' | 'painel' }) {
  const [filters, setFilters] = useState<UnidadeFilters>(p.proprios ?? {});
  const [chamadoFilters, setChamadoFilters] = useState<ChamadosMapaFilters>(p.chamado ?? {});
  estado.chamado = chamadoFilters;
  estado.proprios = filters;
  return createElement(CcoFiltrosPanel, {
    tab: p.tab, filters, onFiltersChange: setFilters, chamadoFilters, onChamadoFiltersChange: setChamadoFilters,
    kpiFilter: 'none', onSituacaoChange: vi.fn(), opcoesFiltro: OPCOES as never, mapMode: 'situacao' as never, onMapModeChange: vi.fn(),
    chamadoMapMode: 'situacao', onChamadoMapModeChange: vi.fn(), categoriaFiltroId: '', onCategoriaFiltroChange: vi.fn(), onClear: vi.fn(),
    resultCount: 0, defaultTiposPendencia: ['CHAMADOS', 'NAO_CONFORMIDADES', 'VISTORIAS'], variante: p.variante ?? 'painel', abrirSinal: 1,
  } as never);
}
const tipoSelect = () => screen.getByRole('combobox', { name: 'Tipo de chamado' }) as HTMLSelectElement;
const auxTipo = () => document.getElementById(tipoSelect().getAttribute('aria-describedby') ?? '')?.textContent;
const opcoes = () => Array.from(tipoSelect().options).slice(1).map((o) => o.textContent);

beforeEach(() => {
  api.mapa.length = 0; api.proprios.length = 0;
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe('316 · aba Chamados', () => {
  it('opções = só os tipos que o backend devolve; consulta leva todos os filtros (datas e rápidos) exceto o tipo', async () => {
    api.respMapa = [{ id: 't2', nome: 'Poda', total: 4 }];
    render(createElement(Harness, { tab: 'chamados', chamado: { status: ['ABERTO'], abertura: { rapido: 30 } as never, tipoChamadoId: ['t2'] } }));
    await tick(300);
    expect(api.mapa.at(-1)).toEqual({ status: ['ABERTO'], abertura: { rapido: 30 } });
    expect(screen.getByText('Poda ×')).toBeTruthy(); // selecionado e válido: mantido
    expect(estado.chamado?.tipoChamadoId).toEqual(['t2']);
  });
  it('tipo selecionado que sumiu é limpo — só ele; os outros filtros ficam', async () => {
    api.respMapa = [{ id: 't1', nome: 'Iluminação', total: 2 }];
    render(createElement(Harness, { tab: 'chamados', chamado: { status: ['ABERTO'], prioridade: ['ALTA'], tipoChamadoId: ['t1', 't3'] } }));
    await tick(300);
    expect(estado.chamado).toEqual({ status: ['ABERTO'], prioridade: ['ALTA'], tipoChamadoId: ['t1'] });
    expect(opcoes()).toEqual([]); // t1 já selecionado
  });
  it('sem tipos: desabilitado com "Nenhum tipo de chamado disponível"; seleção inválida some', async () => {
    api.respMapa = [];
    render(createElement(Harness, { tab: 'chamados', chamado: { tipoChamadoId: ['t3'] } }));
    await tick(300);
    expect(tipoSelect().disabled).toBe(true);
    expect(auxTipo()).toBe('Nenhum tipo de chamado disponível');
    expect(estado.chamado?.tipoChamadoId).toBeUndefined();
  });
  it('mudar outro filtro refaz a consulta (debounce, uma vez) e atualiza as opções', async () => {
    api.respMapa = [{ id: 't1', nome: 'Iluminação', total: 1 }, { id: 't2', nome: 'Poda', total: 1 }];
    render(createElement(Harness, { tab: 'chamados' }));
    await tick(300);
    expect(opcoes()).toEqual(['Iluminação', 'Poda']);
    api.respMapa = [{ id: 't2', nome: 'Poda', total: 1 }];
    fireEvent.change(screen.getByRole('combobox', { name: 'Prioridade' }), { target: { value: 'ALTA' } });
    await tick(100);
    fireEvent.change(screen.getByRole('combobox', { name: 'Prioridade' }), { target: { value: 'BAIXA' } });
    const antes = api.mapa.length;
    await tick(300);
    expect(api.mapa.length).toBe(antes + 1);
    expect(api.mapa.at(-1)).toEqual({ prioridade: ['ALTA', 'BAIXA'] });
    expect(opcoes()).toEqual(['Poda']);
  });
});

describe('316 · aba Próprios', () => {
  it('consulta os tipos dos chamados dos próprios filtrados, sem o próprio tipo de chamado; poda só ele', async () => {
    api.respProprios = [{ id: 't1', nome: 'Iluminação', total: 3 }];
    render(createElement(Harness, { tab: 'proprios', proprios: { bairros: ['Centro'], tiposChamadoId: ['t1', 't2'] } }));
    await tick(300);
    const q = api.proprios.at(-1)!;
    expect(q.tiposChamadoId).toBeUndefined();
    expect(q.bairros).toEqual(['Centro']);
    expect(api.mapa).toEqual([]);
    expect(estado.proprios).toEqual({ bairros: ['Centro'], tiposChamadoId: ['t1'] });
  });
  it('sanfona e painel do mapa usam a mesma regra (mesmo componente)', async () => {
    api.respProprios = [];
    render(createElement(Harness, { tab: 'proprios', variante: 'sanfona' }));
    await tick(300);
    expect(auxTipo()).toBe('Nenhum tipo de chamado disponível');
  });
});
