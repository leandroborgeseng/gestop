import '@/test-utils/jsdom-global';
import { createElement } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildChamadoAcoes, type ChamadoAcao } from '@/lib/chamado-acoes';
import { ChamadoAcoesMobile } from './chamado-acoes-mobile';

const base = {
  podeExcluir: true,
  podeRestaurar: false,
  excluido: false,
  busy: false,
  exclusaoBusy: false,
  pdfBusy: false,
  tarefasPendentes: 0,
};

function montar(acoes: ChamadoAcao[] = buildChamadoAcoes(base)) {
  const onAcao = vi.fn();
  const view = render(
    createElement('div', null, createElement(ChamadoAcoesMobile, { acoes, onAcao }), createElement('p', { 'data-testid': 'fora' }, 'fora')),
  );
  const botao = screen.getByTestId('chamado-mais-acoes');
  const abrir = () => fireEvent.click(botao);
  const menu = () => screen.queryByRole('menu');
  return { onAcao, view, botao, abrir, menu };
}

afterEach(() => cleanup());

describe('291 menu "⋯" — interação', () => {
  it('abre no clique e reflete aria-expanded', () => {
    const { abrir, menu, botao } = montar();
    expect(menu()).toBeNull();
    abrir();
    expect(menu()).not.toBeNull();
    expect(botao.getAttribute('aria-expanded')).toBe('true');
  });

  it('Esc fecha o menu', () => {
    const { abrir, menu } = montar();
    abrir();
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(menu()).toBeNull();
  });

  it('outra tecla não fecha', () => {
    const { abrir, menu } = montar();
    abrir();
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }));
    });
    expect(menu()).not.toBeNull();
  });

  it('clique fora fecha; clique dentro do menu não fecha', () => {
    const { abrir, menu } = montar();
    abrir();
    fireEvent.pointerDown(menu()!);
    expect(menu()).not.toBeNull();
    fireEvent.pointerDown(screen.getByTestId('fora'));
    expect(menu()).toBeNull();
  });

  it.each(['excluir', 'pdf', 'documentos', 'tarefas'])('clicar em "%s" chama onAcao(id) e fecha o menu', (id) => {
    const { abrir, menu, onAcao } = montar();
    abrir();
    const item = menu()!.querySelector(`[data-acao="${id}"]`) as HTMLButtonElement;
    fireEvent.click(item);
    expect(onAcao).toHaveBeenCalledTimes(1);
    expect(onAcao).toHaveBeenCalledWith(id);
    expect(menu()).toBeNull();
  });

  it('item ocupado fica desabilitado e não dispara onAcao', () => {
    const { abrir, menu, onAcao } = montar(buildChamadoAcoes({ ...base, pdfBusy: true, exclusaoBusy: true }));
    abrir();
    for (const id of ['pdf', 'excluir']) {
      const item = menu()!.querySelector(`[data-acao="${id}"]`) as HTMLButtonElement;
      expect(item.disabled, id).toBe(true);
      fireEvent.click(item);
    }
    expect(onAcao).not.toHaveBeenCalled();
    expect(menu()).not.toBeNull();
  });

  it('"Excluir chamado" em --danger; as demais não', () => {
    const { abrir, menu } = montar();
    abrir();
    const cls = (id: string) => (menu()!.querySelector(`[data-acao="${id}"]`) as HTMLElement).className;
    expect(cls('excluir')).toContain('text-[var(--danger)]');
    for (const id of ['pdf', 'documentos', 'tarefas']) expect(cls(id)).not.toContain('--danger');
  });

  it('"Restaurar chamado" chama onAcao("restaurar")', () => {
    const { abrir, menu, onAcao } = montar(buildChamadoAcoes({ ...base, podeRestaurar: true, excluido: true }));
    abrir();
    fireEvent.click(menu()!.querySelector('[data-acao="restaurar"]') as HTMLButtonElement);
    expect(onAcao).toHaveBeenCalledWith('restaurar');
  });
});
