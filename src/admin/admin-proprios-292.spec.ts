import 'reflect-metadata';
import { ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { REQUIRED_ANY_PERMISSIONS_KEY, hasAnyPermission } from '../auth/permissions';
import type { JwtPayload } from '../auth/jwt';
import { adminTabPermissionKeys } from '../domain/admin-permissions';
import { ADMINISTRADOR_SISTEMA_NOME } from '../domain/permissions-catalog';
import { chaveProprios } from '../../frontend/lib/admin-proprios';
import { AdminController } from './admin.controller';
import { AdminService, PROPRIO_FORA_DO_ESCOPO_MSG, normalizeRequestedSecretariaId } from './admin.service';

const SME = '1a4f826c-3c2a-4b1b-ba73-dcc31ab6aa2d';
const SMS = '0403bbcc-0631-4527-883b-81dc0a24e964';
const ACOES = ['visualizar', 'inserir', 'alterar', 'excluir'] as const;
const PROPRIOS_VIAE = ACOES.map((a) => `matriz.admin.proprios.${a}`);

function user(over: Partial<JwtPayload>): JwtPayload {
  return { sub: 'u-292', email: 'gestor.sme@aion.local', nome: 'Gestor', perfis: ['Gestor de Secretaria'], permissoes: PROPRIOS_VIAE, ...over };
}

const unidadeSme = {
  id: 'un-1', secretariaId: SME, codigoPatrimonial: 'PMF-ESC-001', nome: 'EMEB', tipo: 'ESCOLA',
  endereco: 'Rua A', bairro: null, cep: null, latitude: -20.5, longitude: -47.4, raioValidacaoMetros: 200,
  regiao: null, ativo: true, metadata: null,
};

function makeService(unidade = unidadeSme) {
  const prisma = {
    unidadePublica: {
      findUniqueOrThrow: vi.fn().mockResolvedValue(unidade),
      update: vi.fn().mockImplementation(async ({ data }) => ({ ...unidade, ...data })),
      create: vi.fn().mockImplementation(async ({ data }) => ({ id: 'novo', ...data })),
    },
    tipoProprio: { findUnique: vi.fn().mockResolvedValue({ codigo: 'UBS', ativo: true }) },
    usuario: { findUnique: vi.fn().mockResolvedValue(null) },
    logAuditoria: { create: vi.fn().mockResolvedValue({}) },
  };
  return { service: new AdminService(prisma as never), prisma };
}

const dto = (secretariaId: string | undefined) => ({
  secretariaId, codigoPatrimonial: 'pmf-esc-001', nome: 'EMEB', tipo: 'UBS', endereco: 'Rua Nova, 10',
  bairro: 'Centro', cep: '14400-000', regiao: 'NORTE' as never, latitude: -20.55, longitude: -47.41,
  raioValidacaoMetros: 250, ativo: true,
});

/** Chaves que o PermissionsGuard exige no handler do controller. */
function guardKeys(handler: keyof AdminController): string[] {
  return Reflect.getMetadata(REQUIRED_ANY_PERMISSIONS_KEY, AdminController.prototype[handler]) ?? [];
}
const pode = (u: JwtPayload, handler: keyof AdminController) => hasAnyPermission(u, guardKeys(handler));

describe('292 · salvar próprio (critérios 1–3)', () => {
  it('C1: Secretaria específica com Alterar salva tipo, endereço, bairro, CEP, região, lat, long e raio — mesmo com secretariaId "null" do select travado', async () => {
    const { service, prisma } = makeService();
    const u = user({ secretariaId: SME, secretariasIds: [SME] });
    expect(pode(u, 'updateUnidade')).toBe(true);
    const saved = await service.updateUnidade('un-1', dto('null'), u);
    const data = prisma.unidadePublica.update.mock.calls[0][0].data;
    expect(data.secretaria).toEqual({ connect: { id: SME } });
    expect(data).toMatchObject({ tipo: 'UBS', endereco: 'Rua Nova, 10', bairro: 'Centro', cep: '14400-000', regiao: 'NORTE', latitude: -20.55, longitude: -47.41, raioValidacaoMetros: 250 });
    expect(saved.raioValidacaoMetros).toBe(250);
  });

  it('C2: “Todas as Secretarias” com Alterar salva próprio de qualquer Secretaria', async () => {
    const { service, prisma } = makeService({ ...unidadeSme, secretariaId: SMS });
    const u = user({ secretariaId: null, acessoTodasSecretarias: true });
    await service.updateUnidade('un-1', dto(SMS), u);
    expect(prisma.unidadePublica.update).toHaveBeenCalledTimes(1);
  });

  it('C3: próprio de outra Secretaria → 403 com mensagem clara de escopo (não a genérica)', async () => {
    const { service, prisma } = makeService({ ...unidadeSme, secretariaId: SMS });
    const u = user({ secretariaId: SME, secretariasIds: [SME] });
    const err = await service.updateUnidade('un-1', dto(SME), u).catch((e) => e);
    expect(err).toBeInstanceOf(ForbiddenException);
    expect(err.message).toBe(PROPRIO_FORA_DO_ESCOPO_MSG);
    expect(prisma.unidadePublica.update).not.toHaveBeenCalled();
    const errDel = await service.deleteUnidade('un-1', u).catch((e) => e);
    expect(errDel.message).toBe(PROPRIO_FORA_DO_ESCOPO_MSG);
  });

  it('C3: secretariaId real de outra Secretaria no payload continua 403', async () => {
    const { service } = makeService();
    const u = user({ secretariaId: SME, secretariasIds: [SME] });
    await expect(service.updateUnidade('un-1', dto(SMS), u)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('normaliza "null"/"undefined"/vazio do form como ausente', () => {
    expect(normalizeRequestedSecretariaId('null')).toBeUndefined();
    expect(normalizeRequestedSecretariaId(' undefined ')).toBeUndefined();
    expect(normalizeRequestedSecretariaId('')).toBeUndefined();
    expect(normalizeRequestedSecretariaId(` ${SME} `)).toBe(SME);
  });
});

describe('292 · permissões no guard (critérios 4–8)', () => {
  it('C4: Visualizar-only lista, mas PUT/POST/DELETE dão 403', () => {
    const u = user({ permissoes: ['matriz.admin.proprios.visualizar'] });
    expect(pode(u, 'listUnidades')).toBe(true);
    expect(pode(u, 'updateUnidade')).toBe(false);
    expect(pode(u, 'createUnidade')).toBe(false);
    expect(pode(u, 'deleteUnidade')).toBe(false);
  });

  it('C5: sem permissão em Próprios → nenhuma rota de unidades', () => {
    const u = user({ permissoes: ['matriz.cco._tela.visualizar', 'matriz.admin.usuarios.alterar', 'matriz.admin.proprios.executar'] });
    for (const h of ['listUnidades', 'createUnidade', 'updateUnidade', 'deleteUnidade'] as const) {
      expect(pode(u, h)).toBe(false);
    }
  });

  it('C6: Administrador do Sistema tem acesso total sem chave da matriz', () => {
    const u = user({ perfis: [ADMINISTRADOR_SISTEMA_NOME], permissoes: [] });
    for (const h of ['listUnidades', 'createUnidade', 'updateUnidade', 'deleteUnidade'] as const) {
      expect(pode(u, h)).toBe(true);
    }
  });

  it('C7: criar exige Inserir; Alterar sozinho não cria', () => {
    expect(pode(user({ permissoes: ['matriz.admin.proprios.inserir'] }), 'createUnidade')).toBe(true);
    expect(pode(user({ permissoes: ['matriz.admin.proprios.alterar'] }), 'createUnidade')).toBe(false);
  });

  it('C7: excluir/inativar exige Excluir; Alterar sozinho não inativa', () => {
    expect(pode(user({ permissoes: ['matriz.admin.proprios.excluir'] }), 'deleteUnidade')).toBe(true);
    expect(pode(user({ permissoes: ['matriz.admin.proprios.alterar'] }), 'deleteUnidade')).toBe(false);
  });

  it('C7: Inserir na Secretaria ativa cria com a Secretaria da sessão (select travado)', async () => {
    const { service, prisma } = makeService();
    await service.createUnidade(dto('null'), user({ secretariaId: SME, secretariasIds: [SME] }));
    expect(prisma.unidadePublica.create.mock.calls[0][0].data.secretariaId).toBe(SME);
  });

  it('C8: front e back usam a mesma chave matriz.admin.proprios.<ação>', () => {
    const handlers = { visualizar: 'listUnidades', inserir: 'createUnidade', alterar: 'updateUnidade', excluir: 'deleteUnidade' } as const;
    for (const acao of ACOES) {
      const esperada = `matriz.admin.proprios.${acao}`;
      expect(chaveProprios(acao)).toBe(esperada);
      expect(adminTabPermissionKeys('proprios', acao)[0]).toBe(esperada);
      expect(guardKeys(handlers[acao])[0]).toBe(esperada);
    }
  });
});

describe('292 · usuários e equipes não têm o mesmo bug do select travado', () => {
  // Nos dois formulários o front manda `String(form.get('secretariaId') || '')` → '' (não "null"),
  // e o backend força a Secretaria ativa. O teste trava esse contrato no backend.
  const resolve = (u: JwtPayload, requested: string | undefined) =>
    (makeService().service as unknown as { resolveSecretariaIdForCreate: (u: JwtPayload, r?: string) => string })
      .resolveSecretariaIdForCreate(u, requested);
  const gestor = user({ secretariaId: SME, secretariasIds: [SME] });

  it('usuários: secretariaId vazio do select travado vira a Secretaria ativa', () => {
    expect(resolve(gestor, '')).toBe(SME);
  });

  it('equipes: secretariaId vazio do select travado vira a Secretaria ativa; outra Secretaria dá 403', () => {
    expect(resolve(gestor, '')).toBe(SME);
    expect(() => resolve(gestor, SMS)).toThrow(ForbiddenException);
  });
});
