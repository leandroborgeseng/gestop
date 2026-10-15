import '@/test-utils/jsdom-global';
import { createElement } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { TextoExpansivel } from './texto-expansivel';

// jsdom não faz layout: simula 16px por linha e o clamp de 6 linhas quando o estilo está ativo.
const LINHA = 16;
const linhas = (el: HTMLElement) => (el.textContent ?? '').split('\n').length;
const protoH = Object.getOwnPropertyDescriptors(HTMLElement.prototype);
beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'scrollHeight', { configurable: true, get() { return linhas(this) * LINHA; } });
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
    configurable: true,
    get() {
      const clamp = Number((this as HTMLElement).style.webkitLineClamp || 0);
      return (clamp ? Math.min(linhas(this), clamp) : linhas(this)) * LINHA;
    },
  });
});
afterAll(() => {
  if (protoH.scrollHeight) Object.defineProperty(HTMLElement.prototype, 'scrollHeight', protoH.scrollHeight);
  else delete (HTMLElement.prototype as unknown as Record<string, unknown>).scrollHeight;
  if (protoH.clientHeight) Object.defineProperty(HTMLElement.prototype, 'clientHeight', protoH.clientHeight);
  else delete (HTMLElement.prototype as unknown as Record<string, unknown>).clientHeight;
});
afterEach(() => cleanup());

describe('293 · TextoExpansivel', () => {
  it('texto curto: sem botão, texto inteiro', () => {
    render(createElement(TextoExpansivel, { texto: 'a\nb\nc', testId: 't' }));
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByTestId('t').textContent).toBe('a\nb\nc');
  });
  it('texto longo: corta em 6 linhas, Ver mais/Ver menos com aria-expanded, conteúdo nunca truncado', async () => {
    const longo = Array.from({ length: 10 }, (_, i) => `linha ${i + 1}`).join('\n');
    render(createElement(TextoExpansivel, { texto: longo, testId: 't' }));
    const p = screen.getByTestId('t');
    expect(p.textContent).toBe(longo);
    expect(p.style.webkitLineClamp).toBe('6');
    const botao = screen.getByRole('button');
    expect(botao.textContent).toBe('Ver mais');
    expect(botao.getAttribute('aria-expanded')).toBe('false');
    await act(async () => fireEvent.click(botao));
    expect(screen.getByRole('button').textContent).toBe('Ver menos');
    expect(screen.getByRole('button').getAttribute('aria-expanded')).toBe('true');
    expect(p.style.webkitLineClamp).toBe('');
    expect(p.textContent).toBe(longo);
    await act(async () => fireEvent.click(screen.getByRole('button')));
    expect(screen.getByRole('button').textContent).toBe('Ver mais');
  });
  it('Q22: texto com mais de 1000 caracteres aparece inteiro depois de "Ver mais" (nada truncado)', async () => {
    const enorme = Array.from({ length: 40 }, (_, i) => `linha ${String(i + 1).padStart(2, '0')} ${'x'.repeat(40)}`).join('\n');
    expect(enorme.length).toBeGreaterThan(1000);
    render(createElement(TextoExpansivel, { texto: enorme, testId: 't' }));
    expect(screen.getByTestId('t').textContent).toBe(enorme);
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Ver mais' })));
    expect(screen.getByTestId('t').textContent).toBe(enorme);
    expect(screen.getByTestId('t').textContent!.length).toBe(enorme.length);
  });
});
