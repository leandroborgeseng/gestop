import 'reflect-metadata';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { ForbiddenException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { REQUIRED_ANY_PERMISSIONS_KEY, hasAnyPermission } from '../auth/permissions';
import type { JwtPayload } from '../auth/jwt';
import { AdminController } from './admin.controller';

type Caso = { nome: string; permissoes: string[]; acao: 'visualizar' | 'inserir' | 'alterar' | 'excluir'; esperado: boolean };
const { casos } = JSON.parse(
  readFileSync(path.resolve(__dirname, '../../test/fixtures/proprios-paridade-292.json'), 'utf8'),
) as { casos: Caso[] };

const HANDLER = { visualizar: 'listUnidades', inserir: 'createUnidade', alterar: 'updateUnidade', excluir: 'deleteUnidade' } as const;
const keys = (h: string) =>
  (Reflect.getMetadata(REQUIRED_ANY_PERMISSIONS_KEY, (AdminController.prototype as unknown as Record<string, object>)[h]) ?? []) as string[];

/** Mesma decisão do PermissionsGuard: sem permissão → 403. */
function guard(permissoes: string[], acao: Caso['acao']) {
  const user = { sub: 'u', email: 'g@aion.local', nome: 'G', perfis: ['Gestor de Secretaria'], permissoes } as JwtPayload;
  if (!hasAnyPermission(user, keys(HANDLER[acao]))) throw new ForbiddenException();
}

describe('292 · paridade Próprios (API) · tabela compartilhada com o front', () => {
  it('as rotas de Próprios aceitam cadastros.<ação> na lista de chaves (por isso a regra precisa barrar)', () => {
    expect(keys('updateUnidade')).toContain('matriz.admin.cadastros.alterar');
  });
  for (const c of casos) {
    it(`${c.nome} → ${c.esperado ? 'passa' : '403'}`, () => {
      if (c.esperado) expect(() => guard(c.permissoes, c.acao)).not.toThrow();
      else expect(() => guard(c.permissoes, c.acao)).toThrow(ForbiddenException);
    });
  }
});
