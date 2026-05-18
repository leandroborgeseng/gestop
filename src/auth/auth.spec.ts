import { describe, expect, it } from 'vitest';
import { signJwt, verifyJwt } from './jwt';
import { hashPassword, verifyPassword } from './password';
import { hasAllPermissions } from './permissions';

describe('senha de usuario', () => {
  it('gera hash scrypt e valida senha correta', () => {
    const hash = hashPassword('Gestop@123', 'salt-teste');

    expect(hash).toMatch(/^scrypt:/);
    expect(verifyPassword('Gestop@123', hash)).toBe(true);
    expect(verifyPassword('senha-errada', hash)).toBe(false);
  });

  it('rejeita hashes legados ou invalidos', () => {
    expect(verifyPassword('Gestop@123', 'dev-hash-admin')).toBe(false);
  });
});

describe('jwt de sessao', () => {
  it('assina e valida payload de sessao', () => {
    const token = signJwt(
      {
        sub: 'usuario-1',
        nome: 'Administrador',
        email: 'admin@franca.sp.gov.br',
        perfis: ['Administrador do Sistema'],
        permissoes: ['dashboard.visualizar'],
      },
      'secret-teste',
    );

    const payload = verifyJwt(token, 'secret-teste');

    expect(payload.sub).toBe('usuario-1');
    expect(payload.permissoes).toContain('dashboard.visualizar');
  });

  it('rejeita token com segredo incorreto', () => {
    const token = signJwt(
      {
        sub: 'usuario-1',
        nome: 'Administrador',
        email: 'admin@franca.sp.gov.br',
        perfis: ['Administrador do Sistema'],
        permissoes: ['dashboard.visualizar'],
      },
      'secret-teste',
    );

    expect(() => verifyJwt(token, 'outro-secret')).toThrow('Assinatura invalida');
  });
});

describe('RBAC', () => {
  it('confirma permissao quando usuario possui todas as chaves exigidas', () => {
    expect(
      hasAllPermissions(
        {
          permissoes: ['dashboard.visualizar', 'unidades.gerenciar'],
        },
        ['dashboard.visualizar'],
      ),
    ).toBe(true);
  });

  it('nega acesso quando falta permissao exigida', () => {
    expect(
      hasAllPermissions(
        {
          permissoes: ['fiscalizacoes.executar'],
        },
        ['dashboard.visualizar'],
      ),
    ).toBe(false);
  });
});
