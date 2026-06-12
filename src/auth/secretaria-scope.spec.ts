import { describe, expect, it } from 'vitest';
import {
  assertChamadoSecretariaAccess,
  isGlobalOperator,
  isSecretariaScoped,
  resolveChamadoSecretariaFilter,
  resolveSecretariaScopeId,
} from './secretaria-scope';
import { JwtPayload } from './jwt';

const admin: JwtPayload = {
  sub: '1',
  nome: 'Admin',
  email: 'a@x.com',
  perfis: [],
  permissoes: ['usuarios.gerenciar', 'chamados.gerenciar'],
  secretariaId: 'sec-a',
};

const gestorSecretaria: JwtPayload = {
  sub: '2',
  nome: 'Gestor',
  email: 'g@x.com',
  perfis: [],
  permissoes: ['secretaria.gerenciar', 'chamados.gerenciar'],
  secretariaId: 'sec-educacao',
};

const gestorCco: JwtPayload = {
  sub: '3',
  nome: 'CCO',
  email: 'c@x.com',
  perfis: [],
  permissoes: ['chamados.gerenciar'],
  secretariaId: 'sec-servicos',
};

describe('secretaria-scope', () => {
  it('identifica admin global', () => {
    expect(isGlobalOperator(admin)).toBe(true);
    expect(resolveChamadoSecretariaFilter(admin)).toEqual({});
  });

  it('aplica filtro para gestor de secretaria', () => {
    expect(isSecretariaScoped(gestorSecretaria)).toBe(true);
    expect(resolveSecretariaScopeId(gestorSecretaria)).toBe('sec-educacao');
    expect(resolveChamadoSecretariaFilter(gestorSecretaria)).toEqual({ secretariaId: 'sec-educacao' });
  });

  it('nao aplica filtro para gestor CCO sem secretaria.gerenciar', () => {
    expect(isSecretariaScoped(gestorCco)).toBe(false);
    expect(resolveChamadoSecretariaFilter(gestorCco)).toEqual({});
  });

  it('bloqueia acesso cross-secretaria', () => {
    expect(() =>
      assertChamadoSecretariaAccess(gestorSecretaria, { secretariaId: 'sec-servicos' }),
    ).toThrow(/secretaria/i);
    expect(() =>
      assertChamadoSecretariaAccess(gestorSecretaria, { secretariaId: 'sec-educacao' }),
    ).not.toThrow();
  });
});
