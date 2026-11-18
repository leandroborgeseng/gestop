import '@/test-utils/jsdom-global';
import { createElement } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildChamadoAcoes } from '@/lib/chamado-acoes';
import { podeExcluirChamado } from '@/lib/chamado-acesso';
import { ChamadoAcoesMobile } from './chamado-acoes-mobile';

const base = { podeRestaurar: false, excluido: false, busy: false, exclusaoBusy: false, pdfBusy: false, tarefasPendentes: 0 };
const abrirMenu = (podeGerirAbertura?: boolean, temPermissao = true) => {
  const onAcao = vi.fn();
  const acoes = buildChamadoAcoes({ ...base, podeExcluir: podeExcluirChamado(temPermissao, { podeGerirAbertura }) });
  render(createElement(ChamadoAcoesMobile, { acoes, onAcao }));
  fireEvent.click(screen.getByTestId('chamado-mais-acoes'));
  return onAcao;
};
afterEach(cleanup);

describe('310-excluir · "Excluir chamado" só para a Secretaria de execução', () => {
  it('via equipe/próprio (podeGerirAbertura=false): menu sem "Excluir chamado"', () => {
    abrirMenu(false);
    expect(screen.queryByRole('menuitem', { name: /Excluir chamado/ })).toBeNull();
  });
  it('Secretaria de execução (podeGerirAbertura=true): "Excluir chamado" aparece e dispara a ação', () => {
    const onAcao = abrirMenu(true);
    fireEvent.click(screen.getByRole('menuitem', { name: /Excluir chamado/ }));
    expect(onAcao).toHaveBeenCalled();
  });
  it('sem a permissão de excluir: nunca aparece, mesmo na Secretaria de execução', () => {
    abrirMenu(true, false);
    expect(screen.queryByRole('menuitem', { name: /Excluir chamado/ })).toBeNull();
  });
});
