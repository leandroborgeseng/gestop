import { describe, expect, it } from 'vitest';
import { resolveRespostaTexto, deveExibirCabecalhoSecao, tituloPerguntaChecklist } from './checklist-resposta-apresentacao';

describe('resolveRespostaTexto (caminho real do PDF de vistoria)', () => {
  it('formata múltipla nova gravada como JSON array', () => {
    expect(resolveRespostaTexto({ valorTexto: '["Bom","Ótimo"]' })).toBe('Bom, Ótimo');
  });

  it('preserva única antiga gravada como string simples', () => {
    expect(resolveRespostaTexto({ valorTexto: 'Regular' })).toBe('Regular');
  });

  it('trata resposta vazia', () => {
    expect(resolveRespostaTexto({ valorTexto: '' })).toBe('—');
    expect(resolveRespostaTexto({ valorTexto: '  ' })).toBe('—');
    expect(resolveRespostaTexto({})).toBe('—');
  });

  it('formata booleano, número e conformidade', () => {
    expect(resolveRespostaTexto({ valorBooleano: true })).toBe('Sim');
    expect(resolveRespostaTexto({ valorNumero: 3 })).toBe('3');
    expect(resolveRespostaTexto({ conformidade: 'CONFORME' })).toBe('Conforme');
  });
});

describe('título e seção (279)', () => {
  it('nunca inclui código no título visível', () => {
    expect(tituloPerguntaChecklist('Estado do piso', 'ZZ-COD-002')).toBe('Estado do piso');
    expect(tituloPerguntaChecklist('Estado do piso', 'ZZ-COD-002')).not.toContain('ZZ-COD-002');
  });

  it('exibe cabeçalho só na primeira pergunta do grupo consecutivo', () => {
    expect(deveExibirCabecalhoSecao('Infraestrutura básica', '')).toBe(true);
    expect(deveExibirCabecalhoSecao('Infraestrutura básica', 'Infraestrutura básica')).toBe(false);
    expect(deveExibirCabecalhoSecao('Equipamentos e mobiliário', 'Infraestrutura básica')).toBe(true);
    expect(deveExibirCabecalhoSecao(null, 'Infraestrutura básica')).toBe(false);
    expect(deveExibirCabecalhoSecao('', '')).toBe(false);
  });
});
