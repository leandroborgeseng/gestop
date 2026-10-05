import 'reflect-metadata';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { describe, expect, it } from 'vitest';
import { ADMINISTRADOR_SISTEMA_NOME } from '../domain/permissions-catalog';
import { permissionMatrixKey } from '../domain/permissions-catalog';
import { expandSessionPermissionKeys, hasAnyPermission, REQUIRED_ANY_PERMISSIONS_KEY } from '../auth/permissions';
import { PermissionsGuard } from '../auth/permissions.guard';
import { JwtPayload } from '../auth/jwt';
import { DocumentosController } from './documentos.controller';
import { canColetarAssinatura } from '@/lib/permissions-matrix';

const COLETAR_HANDLERS = [
  DocumentosController.prototype.coletarAssinatura,
  DocumentosController.prototype.togglePendente,
] as const;

function jwt(partial: Partial<JwtPayload>): JwtPayload {
  return {
    sub: 'u1',
    email: 'u@example.com',
    nome: 'Usuário',
    perfis: ['Gestor'],
    permissoes: [],
    ...partial,
  };
}

function guardAllows(user: JwtPayload, handler: (typeof COLETAR_HANDLERS)[number]) {
  const guard = new PermissionsGuard(new Reflector());
  const context = {
    getHandler: () => handler,
    getClass: () => DocumentosController,
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  } as unknown as ExecutionContext;
  try {
    return guard.canActivate(context) === true;
  } catch (err) {
    if (err instanceof ForbiddenException) return false;
    throw err;
  }
}

const TABELA: Array<{
  nome: string;
  user: JwtPayload;
  esperado: boolean;
}> = [
  {
    nome: 'só módulo/visualizar',
    user: jwt({
      permissoes: [
        'documentos.visualizar',
        'matriz.documentos._tela.visualizar',
        'matriz.documentos.consultar.visualizar',
      ],
    }),
    esperado: false,
  },
  {
    nome: 'documentos.coletar_assinatura',
    user: jwt({ permissoes: ['documentos.coletar_assinatura'] }),
    esperado: true,
  },
  {
    nome: 'matriz.documentos.coletar_assinatura.executar',
    user: jwt({
      permissoes: [permissionMatrixKey('documentos', 'coletar_assinatura', 'executar')],
    }),
    esperado: true,
  },
  {
    nome: 'documentos.administrar',
    user: jwt({ permissoes: ['documentos.administrar'] }),
    esperado: true,
  },
  {
    nome: 'usuarios.gerenciar sem admin de sistema',
    user: jwt({ permissoes: ['usuarios.gerenciar'], perfis: ['Gestor'] }),
    esperado: false,
  },
  {
    nome: 'Administrador do Sistema',
    user: jwt({ permissoes: [], perfis: [ADMINISTRADOR_SISTEMA_NOME] }),
    esperado: true,
  },
];

describe('paridade canColetarAssinatura × PermissionsGuard (coletar assinatura)', () => {
  it('metadados do controller exigem coletar_assinatura ou administrar', () => {
    const reflector = new Reflector();
    for (const handler of COLETAR_HANDLERS) {
      const keys = reflector.getAllAndOverride<string[]>(REQUIRED_ANY_PERMISSIONS_KEY, [
        handler,
        DocumentosController,
      ]);
      expect(keys).toEqual(['documentos.coletar_assinatura', 'documentos.administrar']);
    }
  });

  it('expandSessionPermissionKeys deriva documentos.coletar_assinatura da chave de matriz executar', () => {
    const expanded = expandSessionPermissionKeys([
      permissionMatrixKey('documentos', 'coletar_assinatura', 'executar'),
    ]);
    expect(expanded.has('documentos.coletar_assinatura')).toBe(true);
  });

  it.each(TABELA)('$nome: front e guard coincidem (esperado $esperado)', ({ user, esperado }) => {
    const front = canColetarAssinatura(user.permissoes, user);
    const any = hasAnyPermission(user, ['documentos.coletar_assinatura', 'documentos.administrar']);
    const guardAssinatura = guardAllows(user, DocumentosController.prototype.coletarAssinatura);
    const guardPendente = guardAllows(user, DocumentosController.prototype.togglePendente);
    expect(front).toBe(esperado);
    expect(any).toBe(esperado);
    expect(guardAssinatura).toBe(esperado);
    expect(guardPendente).toBe(esperado);
  });
});
