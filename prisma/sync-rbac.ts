import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/auth/password';
import { ensurePermissionsCatalog, ensurePermissoesCreateOnly } from '../src/domain/permissions-sync';
import {
  ADMINISTRADOR_SISTEMA_NOME,
  DEMO_FACEF_EMAIL,
  DEMO_GESTOR_EMAIL,
  PERFIS_PADRAO,
  PERMISSOES_FORA_DO_CATALOGO,
  SYNC_RBAC_DEMO_PASSWORD_ENV,
  syncRbacDemoUsersEnabled,
} from './rbac-padrao';
import { logInfo, logStep } from './startup-log';

const connectionString =
  process.env.DATABASE_URL ?? 'postgresql://gestop:gestop@localhost:5432/gestop?schema=public';

export async function syncSystemRbac(prisma: PrismaClient) {
  logStep('sync-rbac', 'Garantindo permissoes e perfis de sistema ausentes');

  const catalogo = await ensurePermissionsCatalog(prisma);
  const legadasCriadas = await ensurePermissoesCreateOnly(prisma, PERMISSOES_FORA_DO_CATALOGO);
  logInfo(
    'sync-rbac',
    `Catalogo: ${catalogo.total} chaves conhecidas, ${catalogo.created} criadas; legadas criadas: ${legadasCriadas}. Descricoes existentes preservadas.`,
  );

  const adminCriado = await ensurePerfisPadrao(prisma);
  await ensureFlagAdministradorSistema(prisma, adminCriado);
  await ensureDemoUsers(prisma);
}

async function ensurePerfisPadrao(prisma: PrismaClient) {
  let adminCriado = false;

  for (const definicao of PERFIS_PADRAO) {
    const existente = await prisma.perfil.findUnique({
      where: { nome: definicao.nome },
      select: { id: true },
    });
    if (existente) {
      logInfo('sync-rbac', `Perfil "${definicao.nome}" ja existe; descricao e vinculos preservados.`);
      continue;
    }

    const perfil = await prisma.perfil.create({
      data: {
        nome: definicao.nome,
        descricao: definicao.descricao,
        sistema: true,
        ativo: true,
        administradorSistema: definicao.administradorSistema,
      },
    });

    const permissoes = await prisma.permissao.findMany({
      where: { chave: { in: [...definicao.chaves] } },
      select: { id: true, chave: true },
    });
    if (permissoes.length > 0) {
      await prisma.perfilPermissao.createMany({
        data: permissoes.map((permissao) => ({
          perfilId: perfil.id,
          permissaoId: permissao.id,
        })),
      });
    }

    if (definicao.nome === ADMINISTRADOR_SISTEMA_NOME) {
      adminCriado = true;
    }

    logInfo(
      'sync-rbac',
      `Perfil "${definicao.nome}" criado com ${permissoes.length} vinculos iniciais.`,
    );
  }

  return adminCriado;
}

/**
 * Liga administradorSistema somente se (a) o perfil Administrador do Sistema
 * acabou de ser criado neste boot, ou (b) nenhum perfil da base tem o flag.
 * O caso (a) já grava o flag na criação. Aqui só resta o caso (b).
 */
async function ensureFlagAdministradorSistema(prisma: PrismaClient, adminCriadoNesteBoot: boolean) {
  if (adminCriadoNesteBoot) {
    logInfo('sync-rbac', 'Administrador do Sistema criado neste boot com administradorSistema.');
    return;
  }

  const comFlag = await prisma.perfil.count({ where: { administradorSistema: true } });
  if (comFlag > 0) {
    return;
  }

  const marcados = await prisma.perfil.updateMany({
    where: { nome: ADMINISTRADOR_SISTEMA_NOME, administradorSistema: false },
    data: { administradorSistema: true },
  });
  if (marcados.count > 0) {
    logInfo(
      'sync-rbac',
      'Nenhum perfil com administradorSistema; flag ligado em Administrador do Sistema.',
    );
  }
}

/** Usuários de demonstração e senha só com SYNC_RBAC_DEMO_USERS=true. Não reescreve quem já existe. */
async function ensureDemoUsers(prisma: PrismaClient) {
  if (!syncRbacDemoUsersEnabled()) {
    return;
  }

  const senha = process.env[SYNC_RBAC_DEMO_PASSWORD_ENV]?.trim();
  if (!senha) {
    logInfo(
      'sync-rbac',
      `${SYNC_RBAC_DEMO_PASSWORD_ENV} ausente; usuarios de demonstracao nao foram criados.`,
    );
    return;
  }

  const senhaHash = hashPassword(senha);
  await ensureGestorSecretariaDemo(prisma, senhaHash);
  await ensureAdministradorFacef(prisma, senhaHash);
}

async function ensureGestorSecretariaDemo(prisma: PrismaClient, senhaHash: string) {
  const perfil = await prisma.perfil.findUnique({
    where: { nome: 'Gestor de Secretaria' },
    select: { id: true },
  });
  const educacao = await prisma.secretaria.findFirst({
    where: { sigla: 'SME' },
    select: { id: true },
  });
  if (!perfil || !educacao) {
    return;
  }

  const existente = await prisma.usuario.findUnique({
    where: { email: DEMO_GESTOR_EMAIL },
    select: { id: true },
  });
  if (existente) {
    logInfo('sync-rbac', `Usuario demo ${DEMO_GESTOR_EMAIL} ja existe; senha e cadastro preservados.`);
    return;
  }

  const usuario = await prisma.usuario.create({
    data: {
      nome: 'Patricia Gestora SME',
      email: DEMO_GESTOR_EMAIL,
      cpf: '44444444444',
      senhaHash,
      cargo: 'Gestora de Secretaria — Educacao',
      secretariaId: educacao.id,
      ativo: true,
    },
  });
  await prisma.usuarioPerfil.create({
    data: { usuarioId: usuario.id, perfilId: perfil.id },
  });
  logInfo('sync-rbac', `Usuario demo gestor secretaria criado: ${usuario.email}`);
}

async function ensureAdministradorFacef(prisma: PrismaClient, senhaHash: string) {
  const perfil = await prisma.perfil.findUnique({
    where: { nome: ADMINISTRADOR_SISTEMA_NOME },
    select: { id: true },
  });
  if (!perfil) {
    logInfo('sync-rbac', `Perfil Administrador do Sistema ausente; ${DEMO_FACEF_EMAIL} nao foi criado.`);
    return;
  }

  const existente = await prisma.usuario.findUnique({
    where: { email: DEMO_FACEF_EMAIL },
    select: { id: true },
  });
  if (existente) {
    logInfo('sync-rbac', `Usuario ${DEMO_FACEF_EMAIL} ja existe; senha e vinculos preservados.`);
    return;
  }

  const usuario = await prisma.usuario.create({
    data: {
      nome: 'Administrador FACEF',
      email: DEMO_FACEF_EMAIL,
      senhaHash,
      cargo: 'Administrador do Sistema',
      perfilAtivoId: perfil.id,
      acessoTodasSecretarias: true,
      ativo: true,
    },
  });
  await prisma.usuarioPerfil.create({
    data: { usuarioId: usuario.id, perfilId: perfil.id },
  });
  logInfo('sync-rbac', `Usuario ${DEMO_FACEF_EMAIL} criado com perfil Administrador do Sistema.`);
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

if (require.main === module) {
  void main().catch((error) => {
    console.error('[SIGMA:sync-rbac] Falha:', error);
    process.exit(1);
  });
}
