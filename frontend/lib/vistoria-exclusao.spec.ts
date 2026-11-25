import { describe, expect, it } from 'vitest';
import {
  canExcluirVistoria,
  canVisualizarVistoriasExcluidas,
  motivoExclusaoValido,
  mostrarBotaoExcluirVistoria,
  VISTORIA_EXCLUIDAS_VISUALIZAR_KEY,
  VISTORIA_EXCLUIR_KEY,
} from './vistoria-exclusao';

describe('305 · exclusão lógica de vistorias (frontend)', () => {
  it('chaves da matriz: Excluir é a ação da tela; Visualizar excluídas é subfunção nova', () => {
    expect(VISTORIA_EXCLUIR_KEY).toBe('matriz.vistorias._tela.excluir');
    expect(VISTORIA_EXCLUIDAS_VISUALIZAR_KEY).toBe('matriz.vistorias.excluidas_visualizar.visualizar');
  });

  it('E1/E4: permissões separadas', () => {
    const so = (k: string) => ({ permissoes: [k] });
    expect(canExcluirVistoria(so(VISTORIA_EXCLUIR_KEY))).toBe(true);
    expect(canExcluirVistoria(so(VISTORIA_EXCLUIDAS_VISUALIZAR_KEY))).toBe(false);
    expect(canVisualizarVistoriasExcluidas(so(VISTORIA_EXCLUIDAS_VISUALIZAR_KEY))).toBe(true);
    expect(canVisualizarVistoriasExcluidas(so(VISTORIA_EXCLUIR_KEY))).toBe(false);
    expect(canExcluirVistoria(null)).toBe(false);
  });

  it('E1: motivo obrigatório (20 a 1000 caracteres, espaços não contam)', () => {
    expect(motivoExclusaoValido('')).toBe(false);
    expect(motivoExclusaoValido('   curto   ')).toBe(false);
    expect(motivoExclusaoValido('x'.repeat(19))).toBe(false);
    expect(motivoExclusaoValido('x'.repeat(20))).toBe(true);
    expect(motivoExclusaoValido('x'.repeat(1001))).toBe(false);
  });

  it('E1/E4: botão só em vistoria concluída e não excluída', () => {
    const u = { permissoes: [VISTORIA_EXCLUIR_KEY] };
    expect(mostrarBotaoExcluirVistoria(u, { status: 'CONCLUIDA' })).toBe(true);
    expect(mostrarBotaoExcluirVistoria(u, { status: 'EM_ANDAMENTO' })).toBe(false);
    expect(mostrarBotaoExcluirVistoria(u, { status: 'EXCLUIDA', excluida: true })).toBe(false);
    expect(mostrarBotaoExcluirVistoria({ permissoes: [] }, { status: 'CONCLUIDA' })).toBe(false);
  });
});
