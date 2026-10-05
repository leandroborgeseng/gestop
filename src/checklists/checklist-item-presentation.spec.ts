import { describe, expect, it } from 'vitest';
import { apresentarValorTexto } from './checklist-item.rules';

describe('apresentarValorTexto (277 - múltipla escolha múltipla)', () => {
  it('apresenta resposta múltipla nova (array JSON) como lista separada por vírgula', () => {
    expect(apresentarValorTexto('["A","B","C"]')).toBe('A, B, C');
    expect(apresentarValorTexto('["Opção 1","Opção 2"]')).toBe('Opção 1, Opção 2');
  });

  it('apresenta resposta única antiga (texto simples) sem alteração', () => {
    expect(apresentarValorTexto('Opção A')).toBe('Opção A');
    expect(apresentarValorTexto('Texto livre da resposta')).toBe('Texto livre da resposta');
  });

  it('apresenta resposta vazia como string vazia', () => {
    expect(apresentarValorTexto('')).toBe('');
    expect(apresentarValorTexto('  ')).toBe('');
  });

  it('apresenta array com espaços extras removidos', () => {
    expect(apresentarValorTexto('[" A "," B "," C "]')).toBe('A, B, C');
  });

  it('apresenta array com valores vazios filtrados', () => {
    expect(apresentarValorTexto('["A","","C"]')).toBe('A, C');
    expect(apresentarValorTexto('["",""]')).toBe('["",""]');
  });

  it('mantém texto quando JSON é inválido', () => {
    expect(apresentarValorTexto('["A","B')).toBe('["A","B');
    expect(apresentarValorTexto('[invalid json]')).toBe('[invalid json]');
  });

  it('mantém texto quando não é array de strings', () => {
    expect(apresentarValorTexto('[1,2,3]')).toBe('[1,2,3]');
    expect(apresentarValorTexto('{"a":"b"}')).toBe('{"a":"b"}');
  });
});
