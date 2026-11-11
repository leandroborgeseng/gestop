import { describe, expect, it } from 'vitest';
import { duracaoRenovacaoSegundos } from './session-duration';
import { signJwt, verifyJwt } from './jwt';
import { hashPassword, verifyPassword } from './password';
import { hasAllPermissions, hasAnyPermission } from './permissions';

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

describe('renovação do token', () => {
  it('sessão de 30 dias renova por mais 30 dias; a de 8 horas permanece curta', () => {
    expect(duracaoRenovacaoSegundos({ iat: 0, exp: 60 * 60 * 24 * 30 })).toBe(60 * 60 * 24 * 30);
    expect(duracaoRenovacaoSegundos({ iat: 1_000, exp: 1_000 + 60 * 60 * 8 })).toBe(60 * 60 * 8);
    expect(duracaoRenovacaoSegundos({})).toBe(60 * 60 * 8);
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

  it('libera qualquer permissão para o perfil ativo Administrador do Sistema', () => {
    expect(
      hasAllPermissions(
        {
          perfis: ['Administrador do Sistema'],
          permissoes: [],
        },
        ['matriz.integracoes.monitorar.executar'],
      ),
    ).toBe(true);
    expect(
      hasAnyPermission(
        {
          perfis: ['Administrador do Sistema'],
          permissoes: [],
        },
        ['matriz.integracoes._tela.executar'],
      ),
    ).toBe(true);
  });

  it('não libera Administrador do Sistema quando o perfil ativo é outro', () => {
    expect(
      hasAnyPermission(
        {
          perfis: ['Gestor CCO'],
          permissoes: ['auditoria.visualizar'],
        },
        ['matriz.integracoes.monitorar.executar'],
      ),
    ).toBe(false);
  });
});
