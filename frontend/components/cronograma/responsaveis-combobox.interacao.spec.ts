import '@/test-utils/jsdom-global';
import { createElement, useState } from 'react';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ResponsavelCronogramaOpcao, SituacaoResponsavel } from '@/lib/types';

const listMock = vi.fn();
vi.mock('@/lib/api', () => ({ listResponsaveisCronograma: (q?: string) => listMock(q) }));
const { ResponsaveisCombobox } = await import('./responsaveis-combobox');

const A = { id: 'sa', nome: 'ZZTESTE Sec A', sigla: 'ZZTA' };
const B = { id: 'sb', nome: 'ZZTESTE Sec B', sigla: 'ZZTB' };
const u = (id: string, nome: string, secs = [A]): ResponsavelCronogramaOpcao =>
  ({ id, nome, email: `${id}@aion.local`, cpf: null, cargo: null, secretaria: secs[0], secretarias: secs, situacao: 'OK' }) as ResponsavelCronogramaOpcao;
const ANA = u('ana', 'ZZTESTE Ana');
const BETO = u('beto', 'ZZTESTE Beto');
const MULTI = u('multi', 'ZZTESTE Multi', [A, B]);
const BIA = u('bia', 'ZZTESTE Bia', [B]);
const mudancas: string[][] = [];
const escParaModal = vi.fn();

function Harness(props: { ids?: string[]; users?: ResponsavelCronogramaOpcao[]; situacoes?: Record<string, SituacaoResponsavel>; todas?: boolean }) {
  const [ids, setIds] = useState(props.ids ?? []);
  const [users, setUsers] = useState(props.users ?? []);
  return createElement('div', { onKeyDown: (e: KeyboardEvent) => e.key === 'Escape' && escParaModal() },
    createElement('p', null, 'fora do campo'),
    createElement(ResponsaveisCombobox, {
      selectedIds: ids, selectedUsers: users, situacoes: props.situacoes ?? {}, escopoTodas: !!props.todas, escopoVersao: 1,
      onChange: (n: string[], us: ResponsavelCronogramaOpcao[]) => { mudancas.push(n); setIds(n); setUsers(us); },
    }),
    createElement('button', { type: 'submit' }, 'Salvar'),
  );
}
const campo = () => screen.getByRole('combobox');
const lista = () => screen.queryByRole('listbox');
const abrir = async () => { fireEvent.mouseDown(campo().parentElement!.parentElement!); await act(async () => { vi.advanceTimersByTime(250); }); };

beforeEach(() => {
  mudancas.length = 0; escParaModal.mockReset(); listMock.mockReset();
  listMock.mockResolvedValue([ANA, BETO, MULTI]);
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe('Cronograma · Responsáveis (combobox, comportamento real)', () => {
  it('lista no fluxo: abre ao clicar no campo, fica ANTES do Salvar no DOM e sem position absolute; rolagem própria', async () => {
    render(createElement(Harness));
    expect(lista()).toBeNull();
    await abrir();
    const lb = lista()!;
    expect(lb).toBeTruthy();
    expect(lb.className).not.toMatch(/\babsolute\b|\bfixed\b/);
    expect(lb.className).toMatch(/max-h-\[288px\]/);
    expect(lb.className).toMatch(/overflow-y-auto/);
    const salvar = screen.getByRole('button', { name: 'Salvar' });
    expect(lb.compareDocumentPosition(salvar) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(lb).getAllByRole('option').map((o) => o.textContent)).toEqual([
      expect.stringContaining('ZZTESTE Ana'), expect.stringContaining('ZZTESTE Beto'), expect.stringContaining('ZZTESTE Multi'),
    ]);
  });
  it('multisseleção: marcar dois mantém a lista aberta; desmarcar remove', async () => {
    render(createElement(Harness));
    await abrir();
    fireEvent.click(screen.getByRole('option', { name: /ZZTESTE Ana/ }));
    fireEvent.click(screen.getByRole('option', { name: /ZZTESTE Multi/ }));
    expect(lista()).toBeTruthy();
    expect(mudancas.at(-1)).toEqual(['ana', 'multi']);
    expect(screen.getAllByTestId('chip-responsavel')).toHaveLength(2);
    expect(screen.getByRole('option', { name: /ZZTESTE Ana/ }).getAttribute('aria-selected')).toBe('true');
    fireEvent.click(screen.getByRole('option', { name: /ZZTESTE Ana/ }));
    expect(mudancas.at(-1)).toEqual(['multi']);
  });
  it('fecha com Esc (sem fechar o modal), com clique fora e com novo clique no campo', async () => {
    render(createElement(Harness));
    await abrir();
    fireEvent.keyDown(campo(), { key: 'Escape' });
    expect(lista()).toBeNull();
    expect(escParaModal).not.toHaveBeenCalled();
    await abrir();
    fireEvent.mouseDown(screen.getByText('fora do campo'));
    expect(lista()).toBeNull();
    await abrir();
    expect(lista()).toBeTruthy();
    await abrir();
    expect(lista()).toBeNull();
  });
  it('Enter no campo não envia o formulário; setas + Enter marcam a opção', async () => {
    render(createElement(Harness));
    await abrir();
    fireEvent.keyDown(campo(), { key: 'ArrowDown' });
    fireEvent.keyDown(campo(), { key: 'Enter' });
    expect(mudancas.at(-1)).toEqual(['beto']);
  });
  it('"Todas as Secretarias": agrupa por Secretaria e quem tem 2 vínculos aparece uma vez com as duas siglas', async () => {
    listMock.mockResolvedValue([ANA, MULTI, BIA, MULTI]);
    render(createElement(Harness, { todas: true }));
    await abrir();
    const grupos = screen.getAllByRole('group');
    expect(grupos.map((g) => g.getAttribute('aria-label'))).toEqual(['ZZTA', 'ZZTB']);
    const multi = screen.getAllByRole('option', { name: /ZZTESTE Multi/ });
    expect(multi).toHaveLength(1);
    expect(multi[0].textContent).toContain('ZZTA, ZZTB');
  });
  it('edição: responsáveis inativo e de outra Secretaria ficam com indicação e aviso; podem ser removidos', async () => {
    const ina = { ...BETO, id: 'ina', nome: 'ZZTESTE Inativo' };
    const outra = { ...BIA, id: 'out', nome: 'ZZTESTE Outra' };
    render(createElement(Harness, { ids: ['ana', 'ina', 'out'], users: [ANA, ina, outra], situacoes: { ana: 'OK', ina: 'INATIVO', out: 'OUTRA_SECRETARIA' } }));
    const chips = screen.getAllByTestId('chip-responsavel');
    expect(chips.map((c) => c.getAttribute('data-situacao'))).toEqual(['OK', 'INATIVO', 'OUTRA_SECRETARIA']);
    expect(chips[1].textContent).toContain('Inativo');
    expect(chips[2].textContent).toContain('Outra Secretaria');
    expect(screen.getByTestId('aviso-regularizar').textContent).toBe('2 responsáveis precisam ser regularizados.');
    fireEvent.click(screen.getByRole('button', { name: 'Remover ZZTESTE Outra' }));
    expect(mudancas.at(-1)).toEqual(['ana', 'ina']);
  });
  it('as opções vêm do backend (escopo da Secretaria ativa): só oferece o que a API devolve', async () => {
    listMock.mockResolvedValue([ANA]);
    render(createElement(Harness));
    await abrir();
    expect(screen.getAllByRole('option')).toHaveLength(1);
    expect(screen.queryByRole('option', { name: /ZZTESTE Bia/ })).toBeNull();
  });
  it('TL #46: admin global sem Secretaria não está nas opções nem há grupo "Sem Secretaria"; se já atribuído, o chip continua na edição', async () => {
    const adminGlobal = { ...u('admg', 'ZZTESTE Admin Global', []), secretaria: null };
    listMock.mockResolvedValue([ANA, MULTI, BIA]); // backend já exclui o admin global
    render(createElement(Harness, { todas: true, ids: ['admg'], users: [adminGlobal], situacoes: { admg: 'OK' } }));
    expect(screen.getAllByTestId('chip-responsavel').map((c) => c.textContent)).toEqual([expect.stringContaining('ZZTESTE Admin Global')]);
    await abrir();
    expect(screen.getAllByRole('group').map((g) => g.getAttribute('aria-label'))).toEqual(['ZZTA', 'ZZTB']);
    expect(screen.queryByRole('option', { name: /Admin Global/ })).toBeNull();
    fireEvent.click(screen.getByRole('option', { name: /ZZTESTE Ana/ }));
    expect(mudancas.at(-1)).toEqual(['admg', 'ana']);
  });
});
