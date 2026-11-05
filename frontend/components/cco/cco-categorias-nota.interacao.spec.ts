/** 319 · CCO › Mapa: Notas — categorias do backend, "Nota geral (Likert)" primeiro, volta para a geral se sumir. */
import '@/test-utils/jsdom-global';
(window as unknown as { matchMedia: unknown }).matchMedia = (q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
import { createElement, useState } from 'react';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { UnidadeFilters } from '@/lib/types';
import { formatNotaMapa, TEXTO_SEM_AVALIACAO } from '@/lib/vistoria-nota';

const api = vi.hoisted(() => ({ chamadas: [] as Array<Record<string, unknown>>, resp: [] as Array<{ id: string; nome: string; total: number }> }));
vi.mock('@/lib/api', () => ({
  listTiposProprioDisponiveis: () => Promise.resolve([]),
  listTiposChamadoDisponiveisMapa: () => Promise.resolve([]),
  listTiposChamadoDisponiveisProprios: () => Promise.resolve([]),
  listCategoriasNotaDisponiveis: (f: Record<string, unknown>) => { api.chamadas.push(JSON.parse(JSON.stringify(f))); return Promise.resolve(api.resp); },
}));
const { CcoFiltrosPanel } = await import('./cco-filtros-panel');

const OPCOES = { secretarias: [], bairros: [], tipos: [], regioes: [], responsaveis: [], equipes: [], tiposChamado: [],
  categoriasVistoria: [{ id: 'cat-sem-nota', nome: 'Catálogo sem nota' }] };
const tick = async (ms = 0) => act(async () => { vi.advanceTimersByTime(ms); for (let i = 0; i < 5; i++) await Promise.resolve(); });
const estado: { categoria?: string; setFilters?: (f: UnidadeFilters) => void } = {};

function Harness(p: { categoria?: string; mapMode?: string; filters?: UnidadeFilters }) {
  const [categoria, setCategoria] = useState(p.categoria ?? '');
  const [filters, setFilters] = useState<UnidadeFilters>(p.filters ?? {});
  estado.categoria = categoria;
  estado.setFilters = setFilters;
  return createElement(CcoFiltrosPanel, {
    tab: 'proprios', filters, onFiltersChange: setFilters, chamadoFilters: {}, onChamadoFiltersChange: vi.fn(),
    kpiFilter: 'none', onSituacaoChange: vi.fn(), opcoesFiltro: OPCOES as never, mapMode: (p.mapMode ?? 'notas') as never, onMapModeChange: vi.fn(),
    chamadoMapMode: 'situacao', onChamadoMapModeChange: vi.fn(), categoriaFiltroId: categoria, onCategoriaFiltroChange: setCategoria, onClear: vi.fn(),
    resultCount: 0, defaultTiposPendencia: ['CHAMADOS', 'NAO_CONFORMIDADES', 'VISTORIAS'], variante: 'painel', abrirSinal: 1,
  } as never);
}
const sel = () => screen.getByRole('combobox', { name: 'Categoria da nota' }) as HTMLSelectElement;
const opcoes = () => Array.from(sel().options).map((o) => o.textContent);

beforeEach(() => { api.chamadas.length = 0; vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] }); });
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe('319 · categorias do Mapa: Notas', () => {
  it('"Nota geral (Likert)" primeiro + só as categorias que o backend devolve (não o catálogo inteiro)', async () => {
    api.resp = [{ id: 'a', nome: 'Água', total: 2 }, { id: 'b', nome: 'banheiro', total: 1 }];
    render(createElement(Harness, { filters: { bairros: ['Centro'] } }));
    await tick(300);
    expect(opcoes()).toEqual(['Nota geral (Likert)', 'Categoria: Água', 'Categoria: banheiro']);
    expect(api.chamadas.at(-1)).toMatchObject({ bairros: ['Centro'] });
  });
  it('categoria selecionada some com a troca de filtro → volta para a Nota geral', async () => {
    api.resp = [{ id: 'a', nome: 'Água', total: 2 }];
    render(createElement(Harness, { categoria: 'a' }));
    await tick(300);
    expect(estado.categoria).toBe('a');
    api.resp = [{ id: 'b', nome: 'banheiro', total: 1 }];
    act(() => estado.setFilters!({ bairros: ['Norte'] }));
    await tick(300);
    expect(estado.categoria).toBe('');
    expect(sel().value).toBe('');
  });
  it('sem nenhuma categoria avaliada: só a Nota geral', async () => {
    api.resp = [];
    render(createElement(Harness, {}));
    await tick(300);
    expect(opcoes()).toEqual(['Nota geral (Likert)']);
  });
  it('fora do modo Notas não consulta', async () => {
    render(createElement(Harness, { mapMode: 'situacao' }));
    await tick(300);
    expect(api.chamadas).toEqual([]);
  });
  it('sem nota vira "Sem avaliação", nunca zero; zero real continua 0,0', () => {
    expect(formatNotaMapa(null)).toBe(TEXTO_SEM_AVALIACAO);
    expect(formatNotaMapa(undefined)).toBe('Sem avaliação');
    expect(formatNotaMapa(0)).toBe('0,0');
  });
});
