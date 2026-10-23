import { describe, expect, it } from 'vitest';
import { responsavelOpcao, secretariasDoUsuario, situacaoResponsavel, whereUsuarioNoEscopo } from './responsaveis-escopo';

const A = { id: 'a', nome: 'Sec A', sigla: 'A' };
const B = { id: 'b', nome: 'Sec B', sigla: 'B' };
const u = (over: Record<string, unknown> = {}) =>
  ({ id: 'u1', nome: 'Fictício', email: 'f@teste.invalid', ativo: true, cargo: null, cargoRef: null, secretaria: A, secretariasVinculos: [{ secretaria: A }, { secretaria: B }], ...over }) as never;

describe('307 — responsáveis no escopo (puro)', () => {
  it('where: global sem filtro; [] zero linhas; ids = principal OU vínculo', () => {
    expect(whereUsuarioNoEscopo(undefined)).toEqual({});
    expect(whereUsuarioNoEscopo([])).toEqual({ id: { in: [] } });
    expect(whereUsuarioNoEscopo(['a'])).toEqual({
      OR: [{ secretariaId: { in: ['a'] } }, { secretariasVinculos: { some: { secretariaId: { in: ['a'] } } } }],
    });
  });
  it('secretarias sem repetir (principal + vínculos)', () => {
    expect(secretariasDoUsuario(u()).map((s) => s.id)).toEqual(['a', 'b']);
  });
  it('situação: inativo > outra Secretaria > ok; global = ok', () => {
    expect(situacaoResponsavel(u({ ativo: false }), ['a'])).toBe('INATIVO');
    expect(situacaoResponsavel(u({ secretaria: B, secretariasVinculos: [] }), ['a'])).toBe('OUTRA_SECRETARIA');
    expect(situacaoResponsavel(u(), ['b'])).toBe('OK');
    expect(situacaoResponsavel(u({ secretaria: B, secretariasVinculos: [] }), undefined)).toBe('OK');
  });
  it('F3: Secretaria principal fora do escopo não é exposta (sigla/nome); dentro do escopo, sim', () => {
    const multiPrincipalA = u({ secretaria: A, secretariasVinculos: [{ secretaria: A }, { secretaria: B }] });
    expect(responsavelOpcao(multiPrincipalA, ['b']).secretaria).toBeNull();
    expect(JSON.stringify(responsavelOpcao(multiPrincipalA, ['b']))).not.toContain('"A"');
    expect(responsavelOpcao(multiPrincipalA, ['a']).secretaria).toEqual(A);
    expect(responsavelOpcao(multiPrincipalA, undefined).secretaria).toEqual(A);
  });
  it('opção lista só as Secretarias do escopo', () => {
    expect(responsavelOpcao(u(), ['a']).secretarias.map((s) => s.id)).toEqual(['a']);
    expect(responsavelOpcao(u(), undefined).secretarias.map((s) => s.id)).toEqual(['a', 'b']);
  });
});
