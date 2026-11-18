import '@/test-utils/jsdom-global';
import { createElement } from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api', () => ({
  getStoredAuth: () => ({ user: { permissoes: ['chamados.gerenciar'] } }),
  updateChamadoAbertura: vi.fn(),
  getSecretariasDestinoExecucao: vi.fn().mockResolvedValue([]),
}));
vi.mock('@/components/ui/snackbar', () => ({ useSnackbar: () => ({ show: vi.fn() }) }));
const { ChamadoAberturaSection } = await import('./chamado-abertura-section');

const B = { id: 'b', nome: 'ZZTESTE Secretaria Beta', sigla: 'ZZTB' };
const resumo = (podeGerirAbertura?: boolean) =>
  ({ id: 'ch1', codigo: 'CH-ZZ', createdAt: '2026-11-04T21:00:00Z', secretaria: B, solicitanteNome: 'ZZTESTE', unidade: { id: 'u', nome: 'ZZTESTE Escola', secretaria: B }, podeGerirAbertura }) as never;

afterEach(cleanup);

describe('310 · TL #48: abertura só leitura quando a execução é de outra Secretaria', () => {
  it('podeGerirAbertura=false: mostra aviso e nenhum lápis de edição (nem da Secretaria de execução)', () => {
    render(createElement(ChamadoAberturaSection, { resumo: resumo(false), onSaved: vi.fn() }));
    expect(screen.getByTestId('abertura-somente-execucao').textContent).toMatch(/não é possível editar, devolver ou transferir/);
    expect(screen.queryByRole('button', { name: /Editar/ })).toBeNull();
  });
  it('podeGerirAbertura=true: sem aviso e com edição da Secretaria de execução', () => {
    render(createElement(ChamadoAberturaSection, { resumo: resumo(true), onSaved: vi.fn() }));
    expect(screen.queryByTestId('abertura-somente-execucao')).toBeNull();
    expect(screen.getByRole('button', { name: 'Editar Secretaria responsável pela execução' })).toBeTruthy();
  });
});
