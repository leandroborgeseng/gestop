import { describe, expect, it } from 'vitest';
import {
  acaoStatusDisponivel,
  rotuloAcaoStatus,
  rotuloSanfonaInativos,
  separarAtivosInativos,
  textoConfirmacaoStatus,
  TEXTOS_CHECKLIST,
} from './inativos';

describe('309 · padrão comum de inativos (frontend)', () => {
  it('C1: rótulo da sanfona com contador', () => {
    expect(rotuloSanfonaInativos(TEXTOS_CHECKLIST, false, 3)).toBe('Mostrar checklists inativos (3)');
    expect(rotuloSanfonaInativos(TEXTOS_CHECKLIST, true, 3)).toBe('Ocultar checklists inativos (3)');
    expect(rotuloSanfonaInativos({ plural: 'cronogramas' }, false, 1)).toBe('Mostrar cronogramas inativos (1)');
  });

  it('C1/C6: separa mantendo a ordem e os contadores batem com o total', () => {
    const itens = [{ id: 'a', ativo: true }, { id: 'b', ativo: false }, { id: 'c', ativo: true }];
    const { ativos, inativos } = separarAtivosInativos(itens);
    expect(ativos.map((i) => i.id)).toEqual(['a', 'c']);
    expect(inativos.map((i) => i.id)).toEqual(['b']);
    expect(ativos.length + inativos.length).toBe(itens.length);
  });

  it('C2: inativo mostra Reativar no lugar de Inativar, com confirmação', () => {
    expect(rotuloAcaoStatus(acaoStatusDisponivel({ ativo: true }))).toBe('Inativar');
    expect(rotuloAcaoStatus(acaoStatusDisponivel({ ativo: false }))).toBe('Reativar');
    expect(textoConfirmacaoStatus(TEXTOS_CHECKLIST, 'REATIVAR').titulo).toBe('Reativar o checklist?');
  });

  it('C3: mensagem de somente leitura é a mesma do backend', () => {
    expect(TEXTOS_CHECKLIST.somenteLeitura).toBe('Este checklist está inativo. Reative o modelo para realizar alterações');
  });
});
