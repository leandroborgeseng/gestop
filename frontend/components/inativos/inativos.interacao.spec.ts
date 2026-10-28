import '@/test-utils/jsdom-global';
import { createElement } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TEXTOS_CHECKLIST } from '@/lib/inativos';
import { AvisoSomenteLeitura, BotaoStatusAtivo, SanfonaInativos, TagInativo } from './inativos';

afterEach(() => cleanup());

describe('309 · componentes do padrão de inativos', () => {
  it('C1: sanfona fechada por padrão, abre/fecha e mostra os inativos com a tag', () => {
    render(
      createElement(SanfonaInativos, { textos: TEXTOS_CHECKLIST, total: 2 },
        createElement('div', null, createElement('span', null, 'Modelo X'), createElement(TagInativo)),
      ),
    );
    const botao = screen.getByRole('button', { name: 'Mostrar checklists inativos (2)' });
    expect(botao.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByText('Modelo X')).toBeNull();
    fireEvent.click(botao);
    expect(screen.getByRole('button', { name: 'Ocultar checklists inativos (2)' }).getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByText('Modelo X')).toBeTruthy();
    expect(screen.getByText('Inativo')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Ocultar checklists inativos (2)' }));
    expect(screen.queryByText('Modelo X')).toBeNull();
  });

  it('C1: sem inativos a sanfona não aparece', () => {
    render(createElement(SanfonaInativos, { textos: TEXTOS_CHECKLIST, total: 0 }, 'x'));
    expect(screen.queryByTestId('sanfona-inativos')).toBeNull();
  });

  it('C2: inativo mostra Reativar; só confirma depois do segundo clique', async () => {
    const onConfirmar = vi.fn().mockResolvedValue(undefined);
    render(createElement(BotaoStatusAtivo, { registro: { ativo: false }, textos: TEXTOS_CHECKLIST, onConfirmar }));
    expect(screen.queryByRole('button', { name: /Inativar/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Reativar/ }));
    expect(onConfirmar).not.toHaveBeenCalled();
    expect(screen.getByText('Reativar o checklist?')).toBeTruthy();
    await act(async () => {
      fireEvent.click(screen.getByTestId('confirmar-status-ativo'));
    });
    expect(onConfirmar).toHaveBeenCalledWith('REATIVAR');
  });

  it('C2: ativo mostra Inativar; cancelar não chama a ação', () => {
    const onConfirmar = vi.fn();
    render(createElement(BotaoStatusAtivo, { registro: { ativo: true }, textos: TEXTOS_CHECKLIST, onConfirmar }));
    fireEvent.click(screen.getByRole('button', { name: /Inativar/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(onConfirmar).not.toHaveBeenCalled();
  });

  it('C3: aviso de somente leitura', () => {
    render(createElement(AvisoSomenteLeitura, { mensagem: TEXTOS_CHECKLIST.somenteLeitura }));
    expect(screen.getByRole('status').textContent).toContain('Reative o modelo para realizar alterações');
  });
});
