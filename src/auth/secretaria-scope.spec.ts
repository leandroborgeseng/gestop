import { describe, expect, it } from 'vitest';
import {
  assertChamadoExecucaoAccess,
  assertChamadoSecretariaAccess,
  assertSecretariaNoEscopo,
  isGlobalOperator,
  isSecretariaScoped,
  resolveChamadoSecretariaFilter,
  resolveSecretariaScopeId,
} from './secretaria-scope';
import { JwtPayload } from './jwt';

const adminTodas: JwtPayload = {
  sub: '1',
  nome: 'Admin',
  email: 'a@x.com',
  perfis: [],
  permissoes: ['usuarios.gerenciar', 'chamados.gerenciar'],
  secretariaId: null,
  acessoTodasSecretarias: true,
};

const adminSecretariaAtiva: JwtPayload = {
  sub: '1b',
  nome: 'Admin',
  email: 'a@x.com',
  perfis: [],
  permissoes: ['usuarios.gerenciar', 'chamados.gerenciar'],
  secretariaId: 'sec-a',
  acessoTodasSecretarias: true,
};

const gestorSecretaria: JwtPayload = {
  sub: '2',
  nome: 'Gestor',
  email: 'g@x.com',
  perfis: [],
  permissoes: ['secretaria.gerenciar', 'chamados.gerenciar'],
  secretariaId: 'sec-educacao',
};

describe('secretaria-scope', () => {
  it('identifica admin em modo Todas sem filtro', () => {
    expect(isGlobalOperator(adminTodas)).toBe(true);
    expect(resolveChamadoSecretariaFilter(adminTodas)).toEqual({});
  });

  it('admin com secretaria ativa filtra pela secretaria', () => {
    expect(resolveSecretariaScopeId(adminSecretariaAtiva)).toBe('sec-a');
    expect(resolveChamadoSecretariaFilter(adminSecretariaAtiva)).toEqual({
      OR: [{ secretariaId: 'sec-a' }, { unidade: { secretariaId: 'sec-a' } }],
    });
  });

  it('aplica filtro para secretaria ativa (execução ou próprio)', () => {
    expect(isSecretariaScoped(gestorSecretaria)).toBe(true);
    expect(resolveSecretariaScopeId(gestorSecretaria)).toBe('sec-educacao');
    expect(resolveChamadoSecretariaFilter(gestorSecretaria)).toEqual({
      OR: [{ secretariaId: 'sec-educacao' }, { unidade: { secretariaId: 'sec-educacao' } }],
    });
  });

  it('visualização permite próprio da secretaria mesmo com execução diferente', () => {
    expect(() =>
      assertChamadoSecretariaAccess(gestorSecretaria, {
        secretariaId: 'sec-servicos',
        unidade: { secretariaId: 'sec-educacao' },
      }),
    ).not.toThrow();
  });

  it('tratativa exige secretaria de execução', () => {
    expect(() =>
      assertChamadoExecucaoAccess(gestorSecretaria, { secretariaId: 'sec-servicos' }),
    ).toThrow(/tratativa|execução/i);
    expect(() =>
      assertChamadoExecucaoAccess(gestorSecretaria, { secretariaId: 'sec-educacao' }),
    ).not.toThrow();
  });

  it('bloqueia visualização fora do escopo', () => {
    expect(() =>
      assertChamadoSecretariaAccess(gestorSecretaria, { secretariaId: 'sec-servicos' }),
    ).toThrow(/secretaria/i);
  });

  it('usuário sem secretaria e sem modo global não vê dados cruzados', () => {
    const semEscopo: JwtPayload = {
      sub: '3',
      nome: 'Operador',
      email: 'o@x.com',
      perfis: [],
      permissoes: ['chamados.ver'],
      secretariaId: null,
      secretariasIds: [],
    };
    expect(resolveChamadoSecretariaFilter(semEscopo)).toEqual({ id: { in: [] } });
    expect(() =>
      assertChamadoSecretariaAccess(semEscopo, { secretariaId: 'sec-educacao' }),
    ).toThrow(/secretaria/i);
  });

  it('impede abertura fora do escopo ativo', () => {
    expect(() => assertSecretariaNoEscopo(gestorSecretaria, 'sec-servicos')).toThrow(/secretaria/i);
    expect(() => assertSecretariaNoEscopo(gestorSecretaria, 'sec-educacao')).not.toThrow();
    expect(() => assertSecretariaNoEscopo(adminTodas, 'sec-qualquer')).not.toThrow();
  });
});
