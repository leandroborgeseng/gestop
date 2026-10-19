import '@/test-utils/jsdom-global';
import { createElement, useState } from 'react';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEBOUNCE_DATA_ABERTURA_MS, FiltroDataAbertura } from './filtro-data-abertura';
import type { FiltroDataAberturaValue } from '@/lib/filtro-data-abertura';

const AGORA = new Date('2026-10-16T19:56:00.000Z');
const mudancas: FiltroDataAberturaValue[] = [];

function Harness({ inicial = {} }: { inicial?: FiltroDataAberturaValue }) {
  const [v, setV] = useState<FiltroDataAberturaValue>(inicial);
  return createElement('div', null,
    createElement(FiltroDataAbertura, { value: v, agora: () => AGORA, onChange: (n: FiltroDataAberturaValue) => { mudancas.push(n); setV(n); } }),
    createElement('button', { type: 'button', onClick: () => setV({}) }, 'externo limpar'),
  );
}
const grupo = () => screen.getByRole('group', { name: 'Tempo desde a abertura' });
const chip = (nome: string) => within(grupo()).getByRole('button', { name: nome });
const inicial = () => screen.getByLabelText('Data inicial') as HTMLInputElement;
const final = () => screen.getByLabelText('Data final') as HTMLInputElement;
const pressionados = () => within(grupo()).getAllByRole('button').filter((b) => b.getAttribute('aria-pressed') === 'true').map((b) => b.textContent);

beforeEach(() => {
  mudancas.length = 0;
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('295 · Data de abertura (componente compartilhado)', () => {
  it('grupo de escolha única anunciado; "Todos" marcado por padrão; rótulos completos', () => {
    render(createElement(Harness));
    expect(within(grupo()).getAllByRole('button').map((b) => b.textContent)).toEqual([
      'Todos', 'Há mais de 10 dias', 'Há mais de 15 dias', 'Há mais de 30 dias', 'Há mais de 45 dias', 'Há mais de 60 dias', 'Há mais de 90 dias', 'Há mais de 180 dias',
    ]);
    expect(pressionados()).toEqual(['Todos']);
    expect(inicial().type).toBe('date');
    expect(screen.queryByText('Limpar período')).toBeNull();
  });
  it('rápido aplica na hora, marca só ele, preenche Data final de referência e mostra a ajuda', () => {
    render(createElement(Harness));
    fireEvent.click(chip('Há mais de 30 dias'));
    expect(mudancas).toEqual([{ rapido: 30, ate: '2026-09-16' }]);
    expect(pressionados()).toEqual(['Há mais de 30 dias']);
    expect(final().value).toBe('2026-09-16');
    expect(inicial().value).toBe('');
    expect(screen.getByText('Abertos antes de 16/09/2026 às 16:56 (mais de 30 dias completos).')).toBeTruthy();
  });
  it('editar uma data depois do rápido desmarca o chip na hora e aplica o período manual após o debounce', () => {
    render(createElement(Harness));
    fireEvent.click(chip('Há mais de 30 dias'));
    fireEvent.change(inicial(), { target: { value: '2026-09-01' } });
    expect(pressionados()).toEqual(['Todos']);
    expect(screen.queryByText(/Abertos antes de/)).toBeNull();
    expect(mudancas).toHaveLength(1);
    act(() => vi.advanceTimersByTime(DEBOUNCE_DATA_ABERTURA_MS - 1));
    expect(mudancas).toHaveLength(1);
    act(() => vi.advanceTimersByTime(1));
    expect(mudancas.at(-1)).toEqual({ de: '2026-09-01', ate: '2026-09-16' });
  });
  it('várias mudanças seguidas: uma única aplicação (debounce)', () => {
    render(createElement(Harness));
    fireEvent.change(inicial(), { target: { value: '2026-09-01' } });
    act(() => vi.advanceTimersByTime(200));
    fireEvent.change(inicial(), { target: { value: '2026-09-02' } });
    act(() => vi.advanceTimersByTime(200));
    fireEvent.change(final(), { target: { value: '2026-09-30' } });
    act(() => vi.advanceTimersByTime(DEBOUNCE_DATA_ABERTURA_MS));
    expect(mudancas).toEqual([{ de: '2026-09-02', ate: '2026-09-30' }]);
    expect(DEBOUNCE_DATA_ABERTURA_MS).toBe(400);
  });
  it('inicial > final: mensagem em alerta, nada é aplicado; corrigir aplica', () => {
    render(createElement(Harness, { inicial: { de: '2026-09-01', ate: '2026-09-30' } }));
    fireEvent.change(inicial(), { target: { value: '2026-10-05' } });
    act(() => vi.advanceTimersByTime(5000));
    const alerta = screen.getByRole('alert');
    expect(alerta.textContent).toBe('A data inicial não pode ser posterior à data final.');
    expect(alerta.className).toContain('text-[var(--danger-ink)]');
    expect(inicial().getAttribute('aria-invalid')).toBe('true');
    expect(mudancas).toEqual([]);
    fireEvent.change(final(), { target: { value: '2026-10-05' } });
    expect(screen.queryByRole('alert')).toBeNull();
    act(() => vi.advanceTimersByTime(DEBOUNCE_DATA_ABERTURA_MS));
    expect(mudancas).toEqual([{ de: '2026-10-05', ate: '2026-10-05' }]);
  });
  it('mudança inválida cancela a aplicação pendente', () => {
    render(createElement(Harness, { inicial: { ate: '2026-09-30' } }));
    fireEvent.change(inicial(), { target: { value: '2026-09-10' } });
    fireEvent.change(inicial(), { target: { value: '2026-10-10' } });
    act(() => vi.advanceTimersByTime(5000));
    expect(mudancas).toEqual([]);
  });
  it('"Todos" e "Limpar período" limpam rápido e datas', () => {
    render(createElement(Harness, { inicial: { de: '2026-09-01', ate: '2026-09-30' } }));
    fireEvent.click(screen.getByRole('button', { name: 'Limpar período' }));
    expect(mudancas.at(-1)).toEqual({});
    expect([inicial().value, final().value]).toEqual(['', '']);
    fireEvent.click(chip('Há mais de 10 dias'));
    fireEvent.click(chip('Todos'));
    expect(mudancas.at(-1)).toEqual({});
    expect(pressionados()).toEqual(['Todos']);
    expect(final().value).toBe('');
  });
  it('rápido descarta edição manual pendente; valor externo (Limpar filtros) zera os campos', () => {
    render(createElement(Harness));
    fireEvent.change(inicial(), { target: { value: '2026-09-01' } });
    fireEvent.click(chip('Há mais de 90 dias'));
    act(() => vi.advanceTimersByTime(5000));
    expect(mudancas).toEqual([{ rapido: 90, ate: '2026-07-18' }]);
    fireEvent.click(screen.getByRole('button', { name: 'externo limpar' }));
    expect([inicial().value, final().value, pressionados()]).toEqual(['', '', ['Todos']]);
  });
  it('mobile: chips e campos com alvo de 44px; datas empilhadas (1 coluna) e lado a lado no sm', () => {
    render(createElement(Harness, { inicial: { de: '2026-09-01' } }));
    for (const b of within(grupo()).getAllByRole('button')) expect(b.className).toContain('min-h-11');
    expect(inicial().className).toContain('h-11');
    expect(screen.getByRole('button', { name: 'Limpar período' }).className).toContain('min-h-11');
    const grade = inicial().closest('label')!.parentElement!;
    expect(grade.className).toContain('grid-cols-1');
    expect(grade.className).toContain('sm:grid-cols-2');
    expect(grade.className).toContain('min-w-0');
  });
});

describe('295 · A1/M1 (revisão UX da #28)', () => {
  it('A1: rápido + Data inicial posterior à referência → nada aplicado e o chip continua marcado (tela = valor aplicado)', () => {
    render(createElement(Harness));
    fireEvent.click(chip('Há mais de 30 dias'));
    fireEvent.change(inicial(), { target: { value: '2026-10-01' } });
    act(() => vi.advanceTimersByTime(5000));
    expect(mudancas).toEqual([{ rapido: 30, ate: '2026-09-16' }]);
    expect(screen.getByRole('alert').textContent).toBe('A data inicial não pode ser posterior à data final.');
    expect(pressionados()).toEqual(['Há mais de 30 dias']);
  });
  it('A1: reclicar o chip já aplicado restaura a tela (limpa a Data inicial, some o erro, mostra a ajuda)', () => {
    render(createElement(Harness));
    fireEvent.click(chip('Há mais de 30 dias'));
    fireEvent.change(inicial(), { target: { value: '2026-10-01' } });
    fireEvent.click(chip('Há mais de 30 dias'));
    expect(inicial().value).toBe('');
    expect(final().value).toBe('2026-09-16');
    expect(screen.queryByRole('alert')).toBeNull();
    expect(pressionados()).toEqual(['Há mais de 30 dias']);
    expect(screen.getByText(/Abertos antes de 16\/09\/2026/)).toBeTruthy();
    act(() => vi.advanceTimersByTime(5000));
    expect(mudancas.every((m) => m.rapido === 30 && !m.de)).toBe(true);
  });
  it('M1: ano incompleto (0002, 0020, 0202) não consulta nem acende erro; ano completo aplica', () => {
    render(createElement(Harness, { inicial: { de: '2026-09-01', ate: '2026-09-30' } }));
    for (const v of ['0002-09-05', '0020-09-05', '0202-09-05']) {
      fireEvent.change(final(), { target: { value: v } });
      act(() => vi.advanceTimersByTime(DEBOUNCE_DATA_ABERTURA_MS));
      expect(screen.queryByRole('alert')).toBeNull();
    }
    expect(mudancas).toEqual([]);
    fireEvent.change(final(), { target: { value: '2026-09-05' } });
    act(() => vi.advanceTimersByTime(DEBOUNCE_DATA_ABERTURA_MS));
    expect(mudancas).toEqual([{ de: '2026-09-01', ate: '2026-09-05' }]);
  });
  it('A1 (borda M1): rápido ativo + ano incompleto na Data inicial → chip continua marcado e nada é aplicado', () => {
    render(createElement(Harness));
    fireEvent.click(chip('Há mais de 30 dias'));
    fireEvent.change(inicial(), { target: { value: '0002-09-05' } });
    act(() => vi.advanceTimersByTime(5000));
    expect(pressionados()).toEqual(['Há mais de 30 dias']);
    expect(screen.queryByRole('alert')).toBeNull();
    expect(mudancas).toEqual([{ rapido: 30, ate: '2026-09-16' }]);
    fireEvent.change(inicial(), { target: { value: '2026-09-05' } });
    expect(pressionados()).toEqual(['Todos']);
  });
});
