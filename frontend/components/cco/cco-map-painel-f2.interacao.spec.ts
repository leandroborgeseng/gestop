import '@/test-utils/jsdom-global';
import { createElement } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CcoMapPainel } from './cco-map-painel';
import { estadoCamadasPadrao } from '@/lib/cco-camadas';

afterEach(() => cleanup());

function midia(map: Record<string, boolean>) {
  const w = window as unknown as { matchMedia?: unknown };
  const antes = w.matchMedia;
  w.matchMedia = (q: string) => ({ matches: Boolean(map[q]), media: q, addEventListener() {}, removeEventListener() {} });
  return () => { w.matchMedia = antes; };
}
const painel = (over: Record<string, unknown> = {}) =>
  createElement(CcoMapPainel, {
    aba: 'filtros', onAba: vi.fn(), onFechar: vi.fn(), fullscreenMode: 'off', tituloAba: 'Todos os chamados',
    filtros: createElement('input', { 'aria-label': 'campo' }), rascunhoPendente: false, avisoExterno: false,
    onLimpar: vi.fn(), onAplicar: vi.fn(), podeAplicar: true,
    camadas: { estado: estadoCamadasPadrao(), arvore: [], carregando: false, erro: false, onTentarNovamente: vi.fn(), onAlternar: vi.fn(), onAlternarGrupo: vi.fn(), onDesligarTodas: vi.fn(), calorLigado: false, onCalor: vi.fn(), algumaLigada: false },
    ...over,
  } as never);

function renderNoMapa(el: ReturnType<typeof painel>) {
  const host = document.createElement('div');
  host.className = 'sigma-map-shell';
  document.body.appendChild(host);
  const r = render(el, { container: host });
  return { host, ...r };
}

describe('299-F2 · sheet < 600 px fora da tela cheia', () => {
  it('fora da tela cheia: sheet fixo na viewport (portal no body), não dentro do mapa, sem pedir tela cheia', () => {
    const mm = midia({ '(max-width: 599px)': true });
    const req = vi.fn();
    (Element.prototype as unknown as { requestFullscreen: unknown }).requestFullscreen = req;
    const { host } = renderNoMapa(painel());
    const p = screen.getByTestId('cco-map-painel');
    expect(host.contains(p)).toBe(false);
    expect(p.parentElement).toBe(document.body);
    expect(p.getAttribute('data-sheet-viewport')).toBe('true');
    expect(p.className).toContain('fixed');
    expect(p.className).toContain('h-[60dvh]');
    expect(p.getAttribute('data-sheet-altura')).toBe('60');
    expect(p.className).toContain('pb-[env(safe-area-inset-bottom)]');
    expect(p.getAttribute('role')).toBe('dialog');
    expect(p.getAttribute('aria-modal')).toBe('true');
    expect(screen.getByRole('button', { name: 'Aplicar filtros' })).toBeTruthy();
    expect(req).not.toHaveBeenCalled();
    mm();
  });

  it('foco preso no sheet fixo (Tab no último volta ao primeiro; Shift+Tab no primeiro vai ao último)', () => {
    const mm = midia({ '(max-width: 599px)': true });
    renderNoMapa(painel());
    const p = screen.getByTestId('cco-map-painel');
    // jsdom não faz layout: offsetParent é null; o filtro aceita o elemento ativo.
    const botoes = Array.from(p.querySelectorAll<HTMLElement>('button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])'));
    const aplicar = screen.getByRole('button', { name: 'Aplicar filtros' });
    expect(botoes[botoes.length - 1]).toBe(aplicar);
    Object.defineProperty(HTMLElement.prototype, 'offsetParent', { configurable: true, get() { return document.body; } });
    try {
      aplicar.focus();
      fireEvent.keyDown(document, { key: 'Tab' });
      expect(document.activeElement).toBe(botoes[0]);
      fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
      expect(document.activeElement).toBe(aplicar);
    } finally {
      delete (HTMLElement.prototype as unknown as { offsetParent?: unknown }).offsetParent;
      mm();
    }
  });

  it('em tela cheia continua dentro do mapa (absolute, 60% do shell)', () => {
    const mm = midia({ '(max-width: 599px)': true });
    const { host } = renderNoMapa(painel({ fullscreenMode: 'native' }));
    const p = screen.getByTestId('cco-map-painel');
    expect(host.contains(p)).toBe(true);
    expect(p.className).toContain('absolute');
    expect(p.className).toContain('h-[60%]');
    expect(p.getAttribute('data-sheet-viewport')).toBeNull();
    mm();
  });

  it('300 UX: alça leva o sheet de 60% a 90% (arrastar para cima ou tocar) e volta a 60% (arrastar para baixo)', () => {
    const mm = midia({ '(max-width: 599px)': true });
    renderNoMapa(painel());
    const p = screen.getByTestId('cco-map-painel');
    const alca = screen.getByTestId('cco-sheet-alca');
    expect(alca.getAttribute('aria-label')).toBe('Expandir painel');
    fireEvent.pointerDown(alca, { clientY: 500 });
    fireEvent.pointerUp(alca, { clientY: 300 });
    fireEvent.click(alca);
    expect(p.getAttribute('data-sheet-altura')).toBe('90');
    expect(p.className).toContain('h-[90dvh]');
    expect(alca.getAttribute('aria-label')).toBe('Reduzir painel');
    fireEvent.pointerDown(alca, { clientY: 300 });
    fireEvent.pointerUp(alca, { clientY: 500 });
    fireEvent.click(alca);
    expect(p.getAttribute('data-sheet-altura')).toBe('60');
    fireEvent.click(alca); // teclado/leitor de tela: clique alterna
    expect(p.getAttribute('data-sheet-altura')).toBe('90');
    mm();
  });

  it('300 UX: desktop sem alça nem altura de sheet', () => {
    const mm = midia({ '(max-width: 599px)': false });
    renderNoMapa(painel());
    expect(screen.queryByTestId('cco-sheet-alca')).toBeNull();
    const p = screen.getByTestId('cco-map-painel');
    expect(p.getAttribute('data-sheet-altura')).toBeNull();
    expect(p.className).toContain('w-[360px]');
    mm();
  });

  it('>= 600 px fora da tela cheia: painel lateral no mapa (sem mudança)', () => {
    const mm = midia({ '(max-width: 599px)': false });
    const { host } = renderNoMapa(painel());
    const p = screen.getByTestId('cco-map-painel');
    expect(host.contains(p)).toBe(true);
    expect(p.getAttribute('data-layout')).toBe('lateral');
    mm();
  });
});

describe('299-F2 · foco fora do sheet', () => {
  it('Tab com o foco fora do sheet modal leva ao primeiro elemento do sheet', () => {
    const mm = midia({ '(max-width: 599px)': true });
    const fora = document.createElement('a'); fora.href = '#'; fora.textContent = 'menu'; document.body.prepend(fora);
    renderNoMapa(painel());
    Object.defineProperty(HTMLElement.prototype, 'offsetParent', { configurable: true, get() { return document.body; } });
    try {
      fora.focus();
      fireEvent.keyDown(document, { key: 'Tab' });
      expect(screen.getByTestId('cco-map-painel').contains(document.activeElement)).toBe(true);
    } finally {
      delete (HTMLElement.prototype as unknown as { offsetParent?: unknown }).offsetParent;
      fora.remove(); mm();
    }
  });
});
