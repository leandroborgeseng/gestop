import '@/test-utils/jsdom-global';
import { createElement } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CcoMapControles } from './cco-map-controles';
import { CcoMapPainel, MSG_CAMADAS_ERRO, MSG_CAMADAS_VAZIO, MSG_ESC_TELA_CHEIA } from './cco-map-painel';
import { estadoCamadasPadrao } from '@/lib/cco-camadas';

afterEach(() => { cleanup(); vi.clearAllMocks(); });

/** matchMedia falso para as consultas do painel; devolve a função que restaura. */
function midia(map: Record<string, boolean>) {
  const w = window as unknown as { matchMedia?: unknown };
  const antes = w.matchMedia;
  w.matchMedia = (q: string) => ({ matches: Boolean(map[q]), media: q, addEventListener() {}, removeEventListener() {} });
  return () => { w.matchMedia = antes; };
}

const camadasBase = (over = {}) => ({
  estado: { ...estadoCamadasPadrao(), gruposAbertos: ['sigma', 'webmap'] }, arvore: [], carregando: false, erro: false,
  onTentarNovamente: vi.fn(), onAlternar: vi.fn(), onAlternarGrupo: vi.fn(), onDesligarTodas: vi.fn(),
  calorLigado: false, onCalor: vi.fn(), algumaLigada: false, ...over,
});
const painel = (over: Record<string, unknown> = {}) =>
  createElement(CcoMapPainel, {
    aba: 'filtros', onAba: vi.fn(), onFechar: vi.fn(), fullscreenMode: 'off', tituloAba: 'Todos os chamados',
    filtros: createElement('input', { 'aria-label': 'campo' }), rascunhoPendente: false, avisoExterno: false,
    onLimpar: vi.fn(), onAplicar: vi.fn(), podeAplicar: false, camadas: camadasBase(), ...over,
  } as never);

describe('299 · controles do mapa', () => {
  const base = { painelAberto: null, onAbrir: vi.fn(), filtrosAtivos: 0, camadasAlemDoPadrao: 0, atualizando: false, onAtualizar: vi.fn(), rascunhoPendente: false };

  it('rótulos, aria-controls e selo de filtros ativos', () => {
    render(createElement(CcoMapControles, { ...base, filtrosAtivos: 3 }));
    const f = screen.getByRole('button', { name: 'Filtros, 3 ativos' });
    expect(f.getAttribute('aria-controls')).toBe('cco-map-painel');
    expect(f.getAttribute('aria-expanded')).toBe('false');
    expect(screen.getByTestId('cco-selo-filtros').textContent).toBe('3');
    expect(screen.getByRole('button', { name: 'Atualizar mapa' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Camadas' })).toBeTruthy();
    expect(f.className).toContain('h-11');
  });

  it('selo some com 0; o chip "Atualizado às" não fica mais na pilha (299-U1)', () => {
    render(createElement(CcoMapControles, base));
    expect(screen.queryByTestId('cco-selo-filtros')).toBeNull();
    expect(screen.queryByTestId('cco-atualizado-as')).toBeNull();
    expect(screen.getByTestId('cco-map-controles').className).toContain('w-11');
  });

  it('atualizando: aria-busy, rótulo "Atualizando mapa…" e clique ignorado', () => {
    const onAtualizar = vi.fn();
    render(createElement(CcoMapControles, { ...base, atualizando: true, onAtualizar }));
    const b = screen.getByRole('button', { name: 'Atualizando mapa…' });
    expect(b.getAttribute('aria-busy')).toBe('true');
    fireEvent.click(b);
    fireEvent.click(b);
    expect(onAtualizar).not.toHaveBeenCalled();
  });

  it('tooltip aparece no foco após 400 ms e some com Esc', () => {
    vi.useFakeTimers();
    render(createElement(CcoMapControles, base));
    fireEvent.focus(screen.getByRole('button', { name: 'Camadas' }));
    act(() => { vi.advanceTimersByTime(450); });
    expect(screen.getByRole('tooltip').textContent).toBe('Camadas');
    act(() => { window.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape' })); });
    expect(screen.queryByRole('tooltip')).toBeNull();
    vi.useRealTimers();
  });
});

describe('299 · painel #cco-map-painel', () => {
  it('um só painel; foco no título; Aplicar desabilitado sem rascunho', () => {
    render(painel());
    expect(document.querySelectorAll('#cco-map-painel')).toHaveLength(1);
    expect(document.activeElement?.tagName).toBe('H2');
    expect((screen.getByRole('button', { name: 'Aplicar filtros' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByTestId('cco-painel-status').textContent).toBe('');
  });

  it('rascunho pendente mostra "Alterações não aplicadas" e libera Aplicar', () => {
    const onAplicar = vi.fn();
    render(painel({ rascunhoPendente: true, podeAplicar: true, onAplicar }));
    expect(screen.getByTestId('cco-painel-status').textContent).toBe('Alterações não aplicadas');
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar filtros' }));
    expect(onAplicar).toHaveBeenCalledTimes(1);
  });

  it('mudança fora do painel avisa', () => {
    render(painel({ avisoExterno: true }));
    expect(screen.getByTestId('cco-painel-status').textContent).toBe('Os filtros foram alterados fora do painel.');
  });

  it('Esc fora da tela cheia fecha; na tela cheia nativa não fecha e mostra a dica', () => {
    const onFechar = vi.fn();
    const { unmount } = render(painel({ onFechar }));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onFechar).toHaveBeenCalledTimes(1);
    unmount();
    const onFechar2 = vi.fn();
    const mm = midia({ '(pointer: fine)': true });
    render(painel({ onFechar: onFechar2, fullscreenMode: 'native' }));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onFechar2).not.toHaveBeenCalled();
    expect(screen.getByTestId('cco-dica-esc').textContent).toBe(MSG_ESC_TELA_CHEIA);
    mm();
  });

  it('299-U3: celular (sem ponteiro fino) não mostra a dica do Esc; rodapé com os mesmos rótulos', () => {
    const mm = midia({ '(max-width: 599px)': true, '(pointer: fine)': false });
    render(painel({ fullscreenMode: 'native' }));
    expect(screen.queryByTestId('cco-dica-esc')).toBeNull();
    expect(screen.getByRole('dialog')).toBeTruthy();
    for (const n of ['Limpar filtros', 'Fechar', 'Aplicar filtros']) expect(screen.getByRole('button', { name: n })).toBeTruthy();
    mm();
  });

  it('299-U3: desktop usa os mesmos rótulos do rodapé', () => {
    render(painel());
    for (const n of ['Limpar filtros', 'Fechar', 'Aplicar filtros']) expect(screen.getByRole('button', { name: n })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Fechar filtros' })).toBeNull();
  });

  it('Esc no fallback por classe fecha o painel (1º Esc)', () => {
    const onFechar = vi.fn();
    render(painel({ onFechar, fullscreenMode: 'fallback' }));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onFechar).toHaveBeenCalledTimes(1);
  });

  it('Camadas (flag on): grupo SIGMA, Webmap vazio literal e rodapé sem Aplicar', () => {
    render(painel({ aba: 'camadas', camadas: camadasBase({ webmapAtivo: true }) }));
    expect(screen.getByLabelText('Próprios públicos')).toBeTruthy();
    expect((screen.getByLabelText('Chamados') as HTMLInputElement).checked).toBe(true);
    expect((screen.getByLabelText('Mapa de calor dos chamados') as HTMLInputElement).checked).toBe(false);
    expect(screen.getByTestId('cco-camadas-vazio').textContent).toBe(MSG_CAMADAS_VAZIO);
    expect(screen.queryByRole('button', { name: 'Aplicar filtros' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Desligar todas' })).toBeNull(); // 299-U2: nada ligado
  });

  it('299-U2 (flag on): "Desligar todas" só com camada ligada', () => {
    const onDesligarTodas = vi.fn();
    render(painel({ aba: 'camadas', camadas: camadasBase({ algumaLigada: true, onDesligarTodas }) }));
    fireEvent.click(screen.getByRole('button', { name: 'Desligar todas' }));
    expect(onDesligarTodas).toHaveBeenCalled();
  });

  it('Camadas (flag on): erro com Tentar novamente; Webmap desligado por padrão e "N de M ligadas"', () => {
    const onTentarNovamente = vi.fn();
    const { unmount } = render(painel({ aba: 'camadas', camadas: camadasBase({ erro: true, onTentarNovamente }) }));
    expect(screen.getByRole('alert').textContent).toContain(MSG_CAMADAS_ERRO);
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    expect(onTentarNovamente).toHaveBeenCalled();
    unmount();
    const estado = { ...estadoCamadasPadrao(), gruposAbertos: ['sigma', 'webmap', 'webmap-grupo:g'] };
    const onAlternar = vi.fn();
    const arvore = [{ id: 'g', titulo: 'Drenagem', camadas: [{ id: 'webmap:a', camadaId: 'a', nomeOriginal: 'Bocas de lobo', geometriaTipo: 'Point', estilo: null, totalElementos: 1, bbox: null, versaoAtual: 1, ligadaPorPadrao: false, pesada: false }] }];
    render(painel({ aba: 'camadas', camadas: camadasBase({ estado, arvore, onAlternar }) }));
    const cb = screen.getByLabelText('Bocas de lobo') as HTMLInputElement;
    expect(cb.checked).toBe(false);
    expect(screen.getByTestId('cco-webmap-resumo').textContent).toBe(' · 0 de 1 ligadas');
    expect(screen.getByText("0/1")).toBeTruthy();
    fireEvent.click(cb);
    expect(onAlternar).toHaveBeenCalledWith('webmap:a', true);
  });

  it('troca de aba pelo tablist', () => {
    const onAba = vi.fn();
    render(painel({ onAba }));
    fireEvent.click(screen.getByRole('tab', { name: 'Camadas' }));
    expect(onAba).toHaveBeenCalledWith('camadas');
  });

  // 300: flag removida — a seção Webmap QGIS aparece sempre, sem variável de ambiente.
  it('300 TL: padrão real => "Webmap QGIS" recolhida (aria-expanded=false), sem grupos nem busca', () => {
    render(painel({ aba: 'camadas', camadas: camadasBase({ estado: estadoCamadasPadrao(), arvore: [{ id: 'g', titulo: 'Drenagem', camadas: [] }] }) }));
    const sec = screen.getByTestId('cco-secao-webmap');
    expect(sec.querySelector('button')!.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByTestId('webmap-busca')).toBeNull();
    expect(screen.queryByTestId('webmap-grupo')).toBeNull();
    expect(screen.getByLabelText('Próprios públicos')).toBeTruthy(); // SIGMA aberta
  });

  it('300 W5: seção "Webmap QGIS" sempre presente, sem env', () => {
    render(painel({ aba: 'camadas', camadas: camadasBase({}) }));
    expect(screen.getByTestId('cco-secao-webmap').textContent).toContain('Webmap QGIS');
  });
});
