import '@/test-utils/jsdom-global';
import { createElement } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CcoMapControles } from './cco-map-controles';
import { CcoMapPainel, MSG_CAMADAS_ERRO, MSG_CAMADAS_VAZIO, MSG_ESC_TELA_CHEIA } from './cco-map-painel';
import { estadoCamadasPadrao } from '@/lib/cco-camadas';

afterEach(() => { cleanup(); vi.clearAllMocks(); });

const camadasBase = (over = {}) => ({
  estado: estadoCamadasPadrao(), arvore: [], carregando: false, erro: false,
  onTentarNovamente: vi.fn(), onAlternar: vi.fn(), onAlternarGrupo: vi.fn(), onDesligarTodas: vi.fn(),
  calorLigado: false, onCalor: vi.fn(), ...over,
});
const painel = (over: Record<string, unknown> = {}) =>
  createElement(CcoMapPainel, {
    aba: 'filtros', onAba: vi.fn(), onFechar: vi.fn(), fullscreenMode: 'off', tituloAba: 'Todos os chamados',
    filtros: createElement('input', { 'aria-label': 'campo' }), rascunhoPendente: false, avisoExterno: false,
    onLimpar: vi.fn(), onAplicar: vi.fn(), podeAplicar: false, camadas: camadasBase(), ...over,
  } as never);

describe('299 · controles do mapa', () => {
  const base = { painelAberto: null, onAbrir: vi.fn(), filtrosAtivos: 0, camadasAlemDoPadrao: 0, atualizando: false, onAtualizar: vi.fn(), rascunhoPendente: false, atualizadoAs: null };

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

  it('selo some com 0; chip "Atualizado às" em role=status', () => {
    render(createElement(CcoMapControles, { ...base, atualizadoAs: '14h35' }));
    expect(screen.queryByTestId('cco-selo-filtros')).toBeNull();
    expect(screen.getByTestId('cco-atualizado-as').textContent).toBe('Atualizado às 14h35');
    expect(screen.getByTestId('cco-atualizado-as').getAttribute('role')).toBe('status');
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
    render(painel({ onFechar: onFechar2, fullscreenMode: 'native' }));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onFechar2).not.toHaveBeenCalled();
    expect(screen.getByTestId('cco-dica-esc').textContent).toBe(MSG_ESC_TELA_CHEIA);
  });

  it('Esc no fallback por classe fecha o painel (1º Esc)', () => {
    const onFechar = vi.fn();
    render(painel({ onFechar, fullscreenMode: 'fallback' }));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onFechar).toHaveBeenCalledTimes(1);
  });

  it('Camadas: grupo SIGMA, Webmap vazio literal e rodapé sem Aplicar', () => {
    render(painel({ aba: 'camadas' }));
    expect(screen.getByLabelText('Próprios públicos')).toBeTruthy();
    expect((screen.getByLabelText('Chamados') as HTMLInputElement).checked).toBe(true);
    expect((screen.getByLabelText('Mapa de calor dos chamados') as HTMLInputElement).checked).toBe(false);
    expect(screen.getByTestId('cco-camadas-vazio').textContent).toBe(MSG_CAMADAS_VAZIO);
    expect(screen.queryByRole('button', { name: 'Aplicar filtros' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Desligar todas' })).toBeTruthy();
  });

  it('Camadas: erro com Tentar novamente; Webmap desligado por padrão e "N de M ligadas"', () => {
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
    expect(screen.getAllByText('0 de 1 ligadas').length).toBe(2);
    fireEvent.click(cb);
    expect(onAlternar).toHaveBeenCalledWith('webmap:a', true);
  });

  it('troca de aba pelo tablist', () => {
    const onAba = vi.fn();
    render(painel({ onAba }));
    fireEvent.click(screen.getByRole('tab', { name: 'Camadas' }));
    expect(onAba).toHaveBeenCalledWith('camadas');
  });
});
