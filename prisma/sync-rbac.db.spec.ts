/**
 * Boot do sync-rbac contra Postgres descartável (banco *_test).
 * Prova criação em base vazia, preservação de edição manual e o flag administradorSistema.
 * Dados só fictícios (ZZTESTE / zzteste@aion.local).
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { Client } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { assertBancoLocal306 } from '../scripts/seed-escopo-306-core';
import { listPermissionsCatalogEntries } from '../src/domain/permissions-sync';
import {
  ADMINISTRADOR_SISTEMA_NOME,
  DEMO_FACEF_EMAIL,
  DEMO_GESTOR_EMAIL,
  PERFIS_PADRAO,
  PERMISSOES_FORA_DO_CATALOGO,
  syncRbacDemoUsersEnabled,
} from './rbac-padrao';
import { syncSystemRbac } from './sync-rbac';

const DB_NAME = 'gestop_sync_rbac_test';
const explicitUrl = process.env.SYNC_RBAC_TEST_DATABASE_URL;
const sourceUrl = explicitUrl ?? process.env.DATABASE_URL ?? process.env.ESCOPO_306_TEST_DATABASE_URL;

function urlDoBanco(base: string, nome: string) {
  const url = new URL(base);
  url.pathname = `/${nome}`;
  url.search = '';
  return url.toString();
}

const testUrl = explicitUrl ?? (sourceUrl ? urlDoBanco(sourceUrl, DB_NAME) : undefined);

describe('sync-rbac — contrato do boot', () => {
  it('a flag de demonstração fica desligada se não for exatamente true', () => {
    expect(syncRbacDemoUsersEnabled({})).toBe(false);
    expect(syncRbacDemoUsersEnabled({ SYNC_RBAC_DEMO_USERS: 'false' })).toBe(false);
    expect(syncRbacDemoUsersEnabled({ SYNC_RBAC_DEMO_USERS: '1' })).toBe(false);
    expect(syncRbacDemoUsersEnabled({ SYNC_RBAC_DEMO_USERS: 'true' })).toBe(true);
  });

  it('o script não apaga vínculo e não grava senha fixa', () => {
    const src = readFileSync(`${__dirname}/sync-rbac.ts`, 'utf8');
    expect(src).not.toMatch(/deleteMany|\.delete\(/);
    expect(src).not.toMatch(/Lean1234|Gestop@123/);
  });
});

describe.skipIf(!testUrl)('sync-rbac — Postgres', () => {
  let prisma: PrismaClient;

  beforeAll(async () => {
    const url = testUrl!;
    const nome = new URL(url).pathname.replace(/^\//, '');
    if (!/^[a-zA-Z0-9_]+$/.test(nome) || !nome.includes('_test')) {
      throw new Error('O banco do sync-rbac precisa de nome simples contendo _test.');
    }
    assertBancoLocal306(url);
    await criarBancoSeFaltar(url, nome);
    execFileSync('npx', ['prisma', 'migrate', 'deploy'], {
      env: { ...process.env, DATABASE_URL: url },
      stdio: 'pipe',
      encoding: 'utf8',
    });
    prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  }, 180_000);

  beforeEach(async () => {
    await prisma.$executeRawUnsafe(`
      TRUNCATE TABLE
        "PerfilPermissao",
        "UsuarioPerfil",
        "UsuarioPermissao",
        "Permissao",
        "Perfil",
        "Usuario",
        "Secretaria"
      RESTART IDENTITY CASCADE
    `);
  });

  afterAll(async () => {
    await prisma?.$disconnect();
  });

  it('numa base vazia cria catálogo, perfis padrão e o flag', async () => {
    await syncSystemRbac(prisma);

    const chaves = new Set((await prisma.permissao.findMany({ select: { chave: true } })).map((item) => item.chave));
    const esperadas = new Set([
      ...listPermissionsCatalogEntries().map((item) => item.chave),
      ...PERMISSOES_FORA_DO_CATALOGO.map((item) => item.chave),
    ]);
    expect(chaves).toEqual(esperadas);

    for (const definicao of PERFIS_PADRAO) {
      const perfil = await prisma.perfil.findUniqueOrThrow({
        where: { nome: definicao.nome },
        include: { permissoes: { include: { permissao: { select: { chave: true } } } } },
      });
      expect(perfil.descricao).toBe(definicao.descricao);
      expect(perfil.sistema).toBe(true);
      expect(perfil.administradorSistema).toBe(definicao.administradorSistema);
      expect(perfil.permissoes.map((item) => item.permissao.chave).sort()).toEqual([...definicao.chaves].sort());
    }

    expect(await prisma.usuario.count()).toBe(0);
    const antes = await snapshotRbac(prisma);
    await syncSystemRbac(prisma);
    expect(await snapshotRbac(prisma)).toEqual(antes);
  });

  it('edições manuais (descrição, vínculo, senha, perfil extra e flag) sobrevivem a duas execuções', async () => {
    await syncSystemRbac(prisma);

    await prisma.permissao.update({
      where: { chave: 'documentos.cancelar' },
      data: { descricao: 'ZZTESTE descricao alterada' },
    });

    const solicitacao = await prisma.perfil.findUniqueOrThrow({ where: { nome: 'Solicitação' } });
    const abrir = await prisma.permissao.findUniqueOrThrow({ where: { chave: 'chamados.abrir' } });
    const dashboard = await prisma.permissao.findUniqueOrThrow({ where: { chave: 'dashboard.visualizar' } });
    await prisma.perfilPermissao.delete({
      where: { perfilId_permissaoId: { perfilId: solicitacao.id, permissaoId: abrir.id } },
    });
    await prisma.perfilPermissao.create({
      data: { perfilId: solicitacao.id, permissaoId: dashboard.id },
    });
    await prisma.perfil.update({
      where: { id: solicitacao.id },
      data: { descricao: 'ZZTESTE solicitacao editada', ativo: false },
    });

    await prisma.perfil.update({
      where: { nome: ADMINISTRADOR_SISTEMA_NOME },
      data: { administradorSistema: false },
    });
    await prisma.perfil.create({
      data: {
        nome: 'ZZTESTE Perfil extra',
        descricao: 'ZZTESTE perfil manual',
        administradorSistema: true,
        sistema: false,
      },
    });

    await prisma.secretaria.create({ data: { sigla: 'SME', nome: 'ZZTESTE Secretaria' } });
    await prisma.usuario.create({
      data: {
        nome: 'ZZTESTE',
        email: 'zzteste@aion.local',
        senhaHash: 'zzteste-hash-original',
        ativo: true,
      },
    });

    const antes = await snapshotRbac(prisma);
    await syncSystemRbac(prisma);
    expect(await snapshotRbac(prisma)).toEqual(antes);
    await syncSystemRbac(prisma);
    expect(await snapshotRbac(prisma)).toEqual(antes);

    expect(await prisma.usuario.findUnique({ where: { email: DEMO_FACEF_EMAIL } })).toBeNull();
    expect(await prisma.usuario.findUnique({ where: { email: DEMO_GESTOR_EMAIL } })).toBeNull();
    expect(
      (await prisma.perfil.findUniqueOrThrow({ where: { nome: ADMINISTRADOR_SISTEMA_NOME } })).administradorSistema,
    ).toBe(false);
    expect(
      (await prisma.perfil.findUniqueOrThrow({ where: { nome: 'ZZTESTE Perfil extra' } })).administradorSistema,
    ).toBe(true);
  });

  it('sem nenhum perfil com o flag, o Administrador do Sistema volta a ter e o resto não muda', async () => {
    await syncSystemRbac(prisma);
    await prisma.perfil.updateMany({ data: { administradorSistema: false } });
    await prisma.permissao.update({
      where: { chave: 'documentos.cancelar' },
      data: { descricao: 'ZZTESTE descricao sem flag' },
    });
    const solicitacao = await prisma.perfil.findUniqueOrThrow({ where: { nome: 'Solicitação' } });
    const abrir = await prisma.permissao.findUniqueOrThrow({ where: { chave: 'chamados.abrir' } });
    await prisma.perfilPermissao.delete({
      where: { perfilId_permissaoId: { perfilId: solicitacao.id, permissaoId: abrir.id } },
    });

    const antes = await snapshotRbac(prisma);
    await syncSystemRbac(prisma);

    const admin = await prisma.perfil.findUniqueOrThrow({ where: { nome: ADMINISTRADOR_SISTEMA_NOME } });
    expect(admin.administradorSistema).toBe(true);
    expect(
      await prisma.perfil.count({
        where: { nome: { not: ADMINISTRADOR_SISTEMA_NOME }, administradorSistema: true },
      }),
    ).toBe(0);

    const depois = await snapshotRbac(prisma);
    expect(depois.permissoes).toEqual(antes.permissoes);
    expect(depois.vinculos).toEqual(antes.vinculos);
    expect(depois.usuarios).toEqual(antes.usuarios);
    expect(depois.usuarioPerfis).toEqual(antes.usuarioPerfis);
    const antesPorNome = new Map(antes.perfis.map((perfil) => [perfil.nome, perfil]));
    for (const perfil of depois.perfis) {
      const previo = antesPorNome.get(perfil.nome)!;
      if (perfil.nome === ADMINISTRADOR_SISTEMA_NOME) {
        expect(previo.administradorSistema).toBe(false);
        expect(perfil.administradorSistema).toBe(true);
        expect(perfil.descricao).toBe(previo.descricao);
        expect(perfil.sistema).toBe(previo.sistema);
        expect(perfil.ativo).toBe(previo.ativo);
      } else {
        expect(perfil).toEqual(previo);
      }
    }

    await syncSystemRbac(prisma);
    expect(await snapshotRbac(prisma)).toEqual(depois);
  });

  it('com a flag, cria o usuário uma vez e não reaplica a senha fictícia', async () => {
    await syncSystemRbac(prisma);
    const users = process.env.SYNC_RBAC_DEMO_USERS;
    const password = process.env.SYNC_RBAC_DEMO_PASSWORD;
    process.env.SYNC_RBAC_DEMO_USERS = 'true';
    process.env.SYNC_RBAC_DEMO_PASSWORD = 'ZZTESTE-senha-0123';
    try {
      await prisma.secretaria.create({ data: { sigla: 'SME', nome: 'ZZTESTE Secretaria' } });
      await syncSystemRbac(prisma);
      const facef = await prisma.usuario.findUnique({ where: { email: DEMO_FACEF_EMAIL } });
      const gestor = await prisma.usuario.findUnique({ where: { email: DEMO_GESTOR_EMAIL } });
      expect(facef?.email).toBe(DEMO_FACEF_EMAIL);
      expect(gestor?.email).toBe(DEMO_GESTOR_EMAIL);
      await prisma.usuario.update({ where: { id: facef!.id }, data: { senhaHash: 'zzteste-hash-alterado' } });
      await prisma.usuario.update({ where: { id: gestor!.id }, data: { senhaHash: 'zzteste-hash-alterado' } });
      const antes = await snapshotRbac(prisma);
      await syncSystemRbac(prisma);
      expect(await snapshotRbac(prisma)).toEqual(antes);
    } finally {
      if (users === undefined) delete process.env.SYNC_RBAC_DEMO_USERS;
      else process.env.SYNC_RBAC_DEMO_USERS = users;
      if (password === undefined) delete process.env.SYNC_RBAC_DEMO_PASSWORD;
      else process.env.SYNC_RBAC_DEMO_PASSWORD = password;
    }
  });
});

async function criarBancoSeFaltar(url: string, nome: string) {
  const admin = new URL(url);
  admin.pathname = '/postgres';
  admin.search = '';
  const client = new Client({ connectionString: admin.toString() });
  await client.connect();
  try {
    const found = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [nome]);
    if (found.rowCount === 0) {
      await client.query(`CREATE DATABASE "${nome}"`);
    }
  } finally {
    await client.end();
  }
}

async function snapshotRbac(prisma: PrismaClient) {
  const [permissoes, perfis, vinculos, usuarios, usuarioPerfis] = await Promise.all([
    prisma.permissao.findMany({
      select: { chave: true, descricao: true, modulo: true },
      orderBy: { chave: 'asc' },
    }),
    prisma.perfil.findMany({
      select: {
        nome: true,
        descricao: true,
        sistema: true,
        ativo: true,
        administradorSistema: true,
        updatedAt: true,
      },
      orderBy: { nome: 'asc' },
    }),
    prisma.perfilPermissao.findMany({
      select: { perfil: { select: { nome: true } }, permissao: { select: { chave: true } } },
    }),
    prisma.usuario.findMany({
      select: {
        email: true,
        nome: true,
        senhaHash: true,
        ativo: true,
        acessoTodasSecretarias: true,
        perfilAtivoId: true,
        secretariaId: true,
        updatedAt: true,
      },
      orderBy: { email: 'asc' },
    }),
    prisma.usuarioPerfil.findMany({
      select: { usuario: { select: { email: true } }, perfil: { select: { nome: true } } },
    }),
  ]);

  return {
    permissoes,
    perfis,
    vinculos: vinculos
      .map((item) => ({ perfil: item.perfil.nome, chave: item.permissao.chave }))
      .sort((a, b) => `${a.perfil}:${a.chave}`.localeCompare(`${b.perfil}:${b.chave}`)),
    usuarios,
    usuarioPerfis: usuarioPerfis
      .map((item) => ({ email: item.usuario.email, perfil: item.perfil.nome }))
      .sort((a, b) => `${a.email}:${a.perfil}`.localeCompare(`${b.email}:${b.perfil}`)),
  };
}
