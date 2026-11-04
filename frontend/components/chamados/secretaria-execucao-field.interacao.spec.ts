import '@/test-utils/jsdom-global';
import { createElement } from 'react';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const listMock = vi.fn();
const saveMock = vi.fn();
vi.mock('@/lib/api', () => ({
  getSecretariasDestinoExecucao: () => listMock(),
  updateChamadoAbertura: (id: string, p: unknown) => saveMock(id, p),
}));
const { SecretariaExecucaoField } = await import('./secretaria-execucao-field');

const A = { id: 'a', nome: 'ZZTESTE Secretaria Alfa', sigla: 'ZZTA' };
const B = { id: 'b', nome: 'ZZTESTE Secretaria Beta', sigla: 'ZZTB' };
const C = { id: 'c', nome: 'ZZTESTE Secretaria Gama', sigla: 'ZZTG' };
const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });

function montar(canEdit = true) {
  const onSaved = vi.fn();
  const onTransferido = vi.fn();
  const onPerdeuAcesso = vi.fn();
  render(createElement(SecretariaExecucaoField, { chamadoId: 'ch1', secretaria: A, canEdit, onSaved, onTransferido, onPerdeuAcesso }));
  return { onSaved, onTransferido, onPerdeuAcesso };
}
const editar = async () => { fireEvent.click(screen.getByRole('button', { name: 'Editar Secretaria responsável pela execução' })); await flush(); };
const select = () => screen.getByRole('combobox') as HTMLSelectElement;

beforeEach(() => { listMock.mockReset().mockResolvedValue([A, B, C]); saveMock.mockReset(); });
afterEach(cleanup);

describe('310 · Secretaria responsável pela execução (comportamento real)', () => {
  it('sem permissão: só leitura, sem lápis e sem buscar a lista', () => {
    montar(false);
    expect(screen.queryByRole('button', { name: /Editar Secretaria/ })).toBeNull();
    expect(screen.getByText(/ZZTA/)).toBeTruthy();
    expect(listMock).not.toHaveBeenCalled();
  });
  it('editar lista TODAS as Secretarias ativas vindas do endpoint de destino; Salvar só habilita ao trocar', async () => {
    montar();
    await editar();
    expect(listMock).toHaveBeenCalledTimes(1);
    expect(Array.from(select().options).map((o) => o.value)).toEqual(['a', 'b', 'c']);
    const salvar = screen.getByRole('button', { name: 'Salvar' }) as HTMLButtonElement;
    expect(salvar.disabled).toBe(true);
    fireEvent.change(select(), { target: { value: 'b' } });
    expect(salvar.disabled).toBe(false);
    expect(screen.getByText('A Secretaria responsável pelo próprio público não muda.')).toBeTruthy();
  });
  it('salvar mostra origem → destino e orienta revisar equipe e responsável incompatíveis', async () => {
    saveMock.mockResolvedValue({ id: 'ch1', transferenciaExecucao: { origem: A, destino: B, saiuDoEscopo: false,
      revisar: { equipe: { id: 'e', nome: 'ZZTESTE Equipe Alfa', secretaria: A }, responsavel: { id: 'u', nome: 'ZZTESTE Gestor Alfa' } } } });
    const { onSaved, onTransferido } = montar();
    await editar();
    fireEvent.change(select(), { target: { value: 'b' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Salvar' })); });
    await flush();
    expect(saveMock).toHaveBeenCalledWith('ch1', { secretariaId: 'b' });
    expect(onSaved).toHaveBeenCalled(); // continua com acesso: só recarrega o detalhe
    expect(onTransferido.mock.calls[0][1]).toBe('Execução transferida: ZZTA → ZZTB.');
    const res = screen.getByTestId('secretaria-execucao-resultado');
    expect(within(res).getByText('Execução transferida: ZZTA → ZZTB.')).toBeTruthy();
    expect(within(res).getAllByTestId('secretaria-execucao-revisar').map((e) => e.textContent)).toEqual([
      'A equipe atual é de outra Secretaria. Revise a equipe do chamado. (ZZTESTE Equipe Alfa · ZZTA)',
      'O responsável atual não pertence à Secretaria de destino. Revise o responsável do chamado. (ZZTESTE Gestor Alfa)',
    ]);
  });
  it('TL #48: continua vendo pela equipe/próprio → NÃO fecha; recarrega em modo só leitura/execução com aviso', async () => {
    saveMock.mockResolvedValue({ id: 'ch1', podeGerirAbertura: false, transferenciaExecucao: { origem: A, destino: B, saiuDoEscopo: false, somenteExecucao: true, revisar: {} } });
    const { onTransferido, onPerdeuAcesso, onSaved } = montar();
    await editar();
    fireEvent.change(select(), { target: { value: 'b' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Salvar' })); });
    expect(onPerdeuAcesso).not.toHaveBeenCalled();
    expect(onSaved).toHaveBeenCalledTimes(1);
    expect(onTransferido.mock.calls[0][1]).toMatch(/^Execução transferida: ZZTA → ZZTB\. Você continua vendo este chamado .*não é possível editar, devolver ou transferir\.$/);
  });
  it('quando sai da Secretaria ativa, avisa que não aparece mais na lista', async () => {
    saveMock.mockResolvedValue({ id: 'ch1', transferenciaExecucao: { origem: A, destino: C, saiuDoEscopo: true, revisar: {} } });
    const { onTransferido, onPerdeuAcesso, onSaved } = montar();
    await editar();
    fireEvent.change(select(), { target: { value: 'c' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Salvar' })); });
    // TL #48: fecha o detalhe e atualiza a lista; não recarrega o detalhe (evita tela de sem acesso)
    expect(onPerdeuAcesso).toHaveBeenCalledTimes(1);
    expect(onSaved).not.toHaveBeenCalled();
    expect(onTransferido.mock.calls[0][1]).toBe('Execução transferida: ZZTA → ZZTG. O chamado saiu da sua Secretaria ativa e foi fechado; a lista foi atualizada.');
  });
  it('erro do backend aparece DENTRO do campo e mantém a edição aberta', async () => {
    saveMock.mockRejectedValue(new Error('Secretaria não encontrada ou inativa.'));
    const { onSaved } = montar();
    await editar();
    fireEvent.change(select(), { target: { value: 'b' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Salvar' })); });
    expect(screen.getByTestId('secretaria-execucao-erro').textContent).toContain('Secretaria não encontrada ou inativa.');
    expect(screen.getByRole('combobox')).toBeTruthy();
    expect(onSaved).not.toHaveBeenCalled();
  });
  it('falha ao carregar a lista aparece no campo (nunca tela vazia)', async () => {
    listMock.mockRejectedValue(new Error('Falha ao consultar API (500)'));
    montar();
    await editar();
    expect(screen.getByTestId('secretaria-execucao-erro').textContent).toContain('Não foi possível carregar as Secretarias. Tente novamente.');
    expect(screen.getByTestId('secretaria-execucao-erro').textContent).not.toContain('500');
    expect(Array.from(select().options).map((o) => o.value)).toEqual(['a']);
  });
});
