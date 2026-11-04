import '@/test-utils/jsdom-global';
import { createElement } from 'react';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AvisoCronogramaInativoExistente, CronogramasCadastrados } from './cronogramas-cadastrados';
import type { CronogramaChecagem } from '@/lib/types';

const sec = { id: 's', nome: 'ZZTESTE Sec A', sigla: 'ZZTA' };
const c = (id: string, nome: string, ativo: boolean): CronogramaChecagem =>
  ({
    id, unidadeId: `u-${id}`, checklistId: 'ck', frequencia: 'MENSAL', proximaChecagemEm: '2026-11-20T12:00:00.000Z', ativo,
    unidade: { id: `u-${id}`, nome, tipo: 'ESCOLA', secretaria: sec }, checklist: { id: 'ck', nome: 'ZZTESTE Checklist', escopo: 'GLOBAL', ativo: true },
    responsaveis: [],
  }) as unknown as CronogramaChecagem;
const LISTA = [c('a1', 'ZZTESTE Escola Ativa', true), c('i1', 'ZZTESTE Praça Inativa', false), c('a2', 'ZZTESTE UBS Ativa', true), c('i2', 'ZZTESTE Ginásio Inativo', false)];

function montar(props: Partial<Parameters<typeof CronogramasCadastrados>[0]> = {}) {
  const onAlterarStatus = vi.fn().mockResolvedValue(undefined);
  const onEditar = vi.fn();
  render(createElement(CronogramasCadastrados, { cronogramas: LISTA, canAlterar: true, canExcluir: true, onEditar, onAlterarStatus, ...props }));
  return { onAlterarStatus, onEditar };
}
const visiveis = () => screen.queryAllByTestId('cronograma-card').filter((el) => !el.closest('[hidden]')).map((el) => el.querySelector('h3')!.textContent);
const card = (nome: string) => screen.getAllByTestId('cronograma-card').find((el) => el.textContent?.includes(nome))!;

afterEach(cleanup);

describe('308 · Cronogramas cadastrados (comportamento real)', () => {
  it('por padrão mostra só os ativos; sanfona "Mostrar cronogramas inativos (2)" abre e fecha', () => {
    montar();
    expect(visiveis()).toEqual(['ZZTESTE Escola Ativa', 'ZZTESTE UBS Ativa']);
    const botao = screen.getByRole('button', { name: 'Mostrar cronogramas inativos (2)' });
    expect(botao.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(botao);
    expect(screen.getByRole('button', { name: 'Ocultar cronogramas inativos (2)' }).getAttribute('aria-expanded')).toBe('true');
    expect(visiveis()).toEqual(['ZZTESTE Escola Ativa', 'ZZTESTE UBS Ativa', 'ZZTESTE Praça InativaInativo', 'ZZTESTE Ginásio InativoInativo']);
    fireEvent.click(screen.getByRole('button', { name: 'Ocultar cronogramas inativos (2)' }));
    expect(visiveis()).toEqual(['ZZTESTE Escola Ativa', 'ZZTESTE UBS Ativa']);
  });
  it('inativo tem tag Inativo, botão Reativar e não tem Editar', () => {
    montar();
    fireEvent.click(screen.getByRole('button', { name: /Mostrar cronogramas inativos/ }));
    const inativo = card('ZZTESTE Praça Inativa');
    expect(within(inativo).getByText('Inativo')).toBeTruthy();
    expect(within(inativo).getByRole('button', { name: 'Reativar' })).toBeTruthy();
    expect(within(inativo).queryByRole('button', { name: 'Editar' })).toBeNull();
    const ativo = card('ZZTESTE Escola Ativa');
    expect(within(ativo).queryByText('Inativo')).toBeNull();
    expect(within(ativo).getByRole('button', { name: 'Inativar' })).toBeTruthy();
  });
  it('Inativar pede confirmação: Cancelar não chama a API; confirmar chama com INATIVAR', async () => {
    const { onAlterarStatus } = montar();
    fireEvent.click(within(card('ZZTESTE Escola Ativa')).getByRole('button', { name: 'Inativar' }));
    expect(screen.getByText('Inativar o cronograma?')).toBeTruthy();
    expect(onAlterarStatus).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(onAlterarStatus).not.toHaveBeenCalled();
    fireEvent.click(within(card('ZZTESTE Escola Ativa')).getByRole('button', { name: 'Inativar' }));
    await act(async () => { fireEvent.click(screen.getByTestId('confirmar-status-ativo')); });
    expect(onAlterarStatus).toHaveBeenCalledTimes(1);
    expect(onAlterarStatus.mock.calls[0][0].id).toBe('a1');
    expect(onAlterarStatus.mock.calls[0][1]).toBe('INATIVAR');
  });
  it('Reativar pede confirmação explicando o recálculo só da próxima data', async () => {
    const { onAlterarStatus } = montar();
    fireEvent.click(screen.getByRole('button', { name: /Mostrar cronogramas inativos/ }));
    fireEvent.click(within(card('ZZTESTE Praça Inativa')).getByRole('button', { name: 'Reativar' }));
    expect(screen.getByText('Reativar o cronograma?')).toBeTruthy();
    expect(screen.getByText(/Só a próxima data é recalculada.*não gera checagens retroativas/)).toBeTruthy();
    await act(async () => { fireEvent.click(screen.getByTestId('confirmar-status-ativo')); });
    expect(onAlterarStatus.mock.calls[0][0].id).toBe('i1');
    expect(onAlterarStatus.mock.calls[0][1]).toBe('REATIVAR');
  });
  it('sem permissão de excluir: nem Inativar nem Reativar; sem alterar: sem Editar', () => {
    montar({ canExcluir: false, canAlterar: false });
    fireEvent.click(screen.getByRole('button', { name: /Mostrar cronogramas inativos/ }));
    expect(screen.queryByRole('button', { name: /^(Inativar|Reativar|Editar)$/ })).toBeNull();
  });
  it('sem inativos não mostra a sanfona; só inativos mostra aviso de nenhum ativo', () => {
    montar({ cronogramas: [LISTA[0]] });
    expect(screen.queryByTestId('sanfona-inativos')).toBeNull();
    cleanup();
    montar({ cronogramas: [LISTA[1]] });
    expect(screen.getByText('Nenhum cronograma ativo para os filtros atuais.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Mostrar cronogramas inativos (1)' })).toBeTruthy();
  });
});

describe('308 · decisões do TL no PR #47 (comportamento real)', () => {
  it('inativo com checklist ou próprio inativo diz qual reativar antes', () => {
    const ckInativo = { ...c('x1', 'ZZTESTE Escola X', false), checklist: { id: 'ck', nome: 'ZZTESTE Ck', escopo: 'GLOBAL', ativo: false } } as CronogramaChecagem;
    const unInativa = { ...c('x2', 'ZZTESTE Escola Y', false), unidade: { ...c('x2', 'ZZTESTE Escola Y', false).unidade, ativo: false } } as CronogramaChecagem;
    montar({ cronogramas: [ckInativo, unInativa] });
    fireEvent.click(screen.getByRole('button', { name: /Mostrar cronogramas inativos/ }));
    expect(within(card('ZZTESTE Escola X')).getByTestId('cronograma-dependencia-inativa').textContent).toBe('Checklist inativo: reative o checklist antes de reativar este cronograma.');
    expect(within(card('ZZTESTE Escola Y')).getByTestId('cronograma-dependencia-inativa').textContent).toBe('Próprio inativo: reative o próprio antes de reativar este cronograma.');
  });
  it('formulário: par com cronograma inativo mostra a mensagem e Reativar com confirmação', async () => {
    const onReativar = vi.fn().mockResolvedValue(undefined);
    render(createElement(AvisoCronogramaInativoExistente, { cronograma: LISTA[1], canReativar: true, onReativar }));
    const aviso = screen.getByTestId('cronograma-inativo-existente');
    expect(aviso.textContent).toContain('Já existe um cronograma inativo para este próprio e checklist');
    fireEvent.click(within(aviso).getByRole('button', { name: 'Reativar' }));
    expect(onReativar).not.toHaveBeenCalled();
    await act(async () => { fireEvent.click(screen.getByTestId('confirmar-status-ativo')); });
    expect(onReativar).toHaveBeenCalledWith(LISTA[1]);
  });
  it('formulário sem permissão de reativar: mensagem sem botão', () => {
    render(createElement(AvisoCronogramaInativoExistente, { cronograma: LISTA[1], canReativar: false, onReativar: vi.fn() }));
    expect(screen.queryByRole('button', { name: 'Reativar' })).toBeNull();
    expect(screen.getByText('Peça a quem tem permissão para reativá-lo.')).toBeTruthy();
  });
});
