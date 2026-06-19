import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/auth/password';
import { logInfo, logStep } from './startup-log';

const GESTOR_SECRETARIA_PERMISSOES = [
  'secretaria.gerenciar',
  'chamados.gerenciar',
  'chamados.executar',
  'chamados.editar_abertura',
  'chamados.execucao_manual',
  'dashboard.visualizar',
] as const;

const NOVAS_PERMISSOES = [
  ['chamados.editar_abertura', 'Editar informacoes de abertura do chamado', 'chamados'],
  ['chamados.execucao_manual', 'Lancar execucao de chamado manualmente', 'chamados'],
] as const;

const connectionString =
  process.env.DATABASE_URL ?? 'postgresql://gestop:gestop@localhost:5432/gestop?schema=public';

export async function syncSystemRbac(prisma: PrismaClient) {
  logStep('sync-rbac', 'Sincronizando permissoes e perfis de sistema');

  for (const [chave, descricao, modulo] of NOVAS_PERMISSOES) {
    await prisma.permissao.upsert({
      where: { chave },
      update: { descricao, modulo },
      create: { chave, descricao, modulo },
    });
  }

  await prisma.permissao.upsert({
    where: { chave: 'secretaria.gerenciar' },
    update: {
      descricao: 'Gerenciar operacao da propria secretaria',
      modulo: 'operacao',
    },
    create: {
      chave: 'secretaria.gerenciar',
      descricao: 'Gerenciar operacao da propria secretaria',
      modulo: 'operacao',
    },
  });

  const perfil = await prisma.perfil.upsert({
    where: { nome: 'Gestor de Secretaria' },
    update: {
      descricao: 'Gestao operacional limitada a uma secretaria municipal',
      sistema: true,
    },
    create: {
      nome: 'Gestor de Secretaria',
      descricao: 'Gestao operacional limitada a uma secretaria municipal',
      sistema: true,
    },
  });

  const permissoes = await prisma.permissao.findMany({
    where: { chave: { in: [...GESTOR_SECRETARIA_PERMISSOES] } },
    select: { id: true },
  });

  for (const permissao of permissoes) {
    await prisma.perfilPermissao.upsert({
      where: {
        perfilId_permissaoId: {
          perfilId: perfil.id,
          permissaoId: permissao.id,
        },
      },
      update: {},
      create: {
        perfilId: perfil.id,
        permissaoId: permissao.id,
      },
    });
  }

  const educacao = await prisma.secretaria.findFirst({
    where: { sigla: 'SME' },
    select: { id: true },
  });

  if (educacao) {
    const senha = process.env.INITIAL_ADMIN_PASSWORD?.trim() || 'Gestop@123';
    const senhaHash = await hashPassword(senha);

    const usuario = await prisma.usuario.upsert({
      where: { email: 'gestor.educacao@franca.sp.gov.br' },
      update: {
        nome: 'Patricia Gestora SME',
        secretariaId: educacao.id,
        ativo: true,
      },
      create: {
        nome: 'Patricia Gestora SME',
        email: 'gestor.educacao@franca.sp.gov.br',
        cpf: '44444444444',
        senhaHash,
        cargo: 'Gestora de Secretaria — Educacao',
        secretariaId: educacao.id,
        ativo: true,
      },
    });

    await prisma.usuarioPerfil.upsert({
      where: {
        usuarioId_perfilId: {
          usuarioId: usuario.id,
          perfilId: perfil.id,
        },
      },
      update: {},
      create: {
        usuarioId: usuario.id,
        perfilId: perfil.id,
      },
    });

    logInfo('sync-rbac', `Usuario demo gestor secretaria: ${usuario.email}`);
  }

  logInfo('sync-rbac', `Perfil "${perfil.nome}" sincronizado (${permissoes.length} permissoes).`);

  const adminPerfil = await prisma.perfil.findFirst({ where: { nome: 'Administrador do Sistema' }, select: { id: true } });
  const gestorPerfil = await prisma.perfil.findFirst({ where: { nome: 'Gestor CCO' }, select: { id: true } });
  const novasPermissoes = await prisma.permissao.findMany({
    where: { chave: { in: NOVAS_PERMISSOES.map(([chave]) => chave) } },
    select: { id: true },
  });

  for (const target of [adminPerfil, gestorPerfil, perfil].filter(Boolean)) {
    for (const permissao of novasPermissoes) {
      await prisma.perfilPermissao.upsert({
        where: {
          perfilId_permissaoId: {
            perfilId: target!.id,
            permissaoId: permissao.id,
          },
        },
        update: {},
        create: {
          perfilId: target!.id,
          permissaoId: permissao.id,
        },
      });
    }
  }
}

async function main() {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });

  try {
    await syncSystemRbac(prisma);
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error) => {
  console.error('[SIGMA:sync-rbac] Falha:', error);
  process.exit(1);
});
