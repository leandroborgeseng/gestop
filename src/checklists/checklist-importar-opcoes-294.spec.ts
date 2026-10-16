import { ChecklistItemTipo } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import {
  assertValidChecklistVersionItems,
  MAX_OPCOES_MULTIPLA_ESCOLHA,
  MAX_TAMANHO_OPCAO_MULTIPLA_ESCOLHA,
  normalizeChecklistItemOpcoes,
  validateChecklistItemOpcoes,
} from './checklist-item.rules';

const opcoes = (n: number) => Array.from({ length: n }, (_, i) => `Opção ${i + 1}`);
const ME = ChecklistItemTipo.MULTIPLA_ESCOLHA;

describe('294 · backend valida a lista de opções ao salvar', () => {
  it('limites nomeados', () => {
    expect(MAX_OPCOES_MULTIPLA_ESCOLHA).toBe(500);
    expect(MAX_TAMANHO_OPCAO_MULTIPLA_ESCOLHA).toBe(500);
  });
  it('500 opções passam; 501 são recusadas com a contagem', () => {
    expect(validateChecklistItemOpcoes(ME, { opcoes: opcoes(500) }, 'Pergunta', 'P1')).toBeNull();
    expect(validateChecklistItemOpcoes(ME, { opcoes: opcoes(501) }, 'Pergunta', 'P1')).toBe(
      'Item "Pergunta": no maximo 500 opcoes de multipla escolha (recebidas 501).',
    );
  });
  it('opção acima do tamanho máximo é recusada com a posição', () => {
    const lista = ['Curta', 'x'.repeat(501), 'Outra'];
    expect(validateChecklistItemOpcoes(ME, { opcoes: lista }, 'Pergunta', 'P1')).toBe(
      'Item "Pergunta": a opcao 2 passa de 500 caracteres.',
    );
    expect(validateChecklistItemOpcoes(ME, { opcoes: ['ok', 'x'.repeat(500)] }, 'Pergunta', 'P1')).toBeNull();
  });
  it('nota fora de 0–10 recusada na vistoria e ignorada em documento avulso', () => {
    expect(validateChecklistItemOpcoes(ME, { opcoes: ['A', 'B'], notas: [5, 11] }, 'Pergunta', 'P1')).toBe(
      'Item "Pergunta": nota da opcao deve estar entre 0 e 10.',
    );
    expect(validateChecklistItemOpcoes(ME, { opcoes: ['A', 'B'], notas: [5, 11] }, 'Pergunta', 'P1', { ignorarAvaliacao: true })).toBeNull();
  });
  it('salvar a versão com 501 opções lança erro (assertValidChecklistVersionItems)', () => {
    const item = { ordem: 1, codigo: 'P1', titulo: 'Pergunta', tipo: ME, opcoes: { opcoes: opcoes(501) }, categoriaVistoriaId: 'cat' };
    expect(() => assertValidChecklistVersionItems([item] as never)).toThrow('no maximo 500 opcoes');
  });
  it('normalização preserva a ordem e não muda seleção/exibição; documento avulso não grava notas', () => {
    const lista = opcoes(200);
    const r = normalizeChecklistItemOpcoes(ME, { opcoes: lista, selecao: 'MULTIPLA', modoExibicao: 'LISTA', notas: lista.map(() => 5) }, { omitirAvaliacao: true }) as Record<string, unknown>;
    expect(r).toEqual({ opcoes: lista, selecao: 'MULTIPLA', modoExibicao: 'LISTA' });
  });
});
