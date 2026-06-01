import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { hashPassword, verifyPassword } from '../src/auth/password';
import { logError, logInfo, logStep, logWarn } from './startup-log';

const ADMIN_EMAIL = 'admin.gestop@franca.sp.gov.br';
/** Fallback de deploy — usado quando INITIAL_ADMIN_PASSWORD nao vem do ambiente. */
const PRODUCTION_ADMIN_PASSWORD_FALLBACK = 'Mudar123';

function isProductionRuntime() {
  return (
    process.env.NODE_ENV === 'production' ||
    Boolean(process.env.RAILWAY_ENVIRONMENT) ||
    Boolean(process.env.RAILWAY_PROJECT_ID)
  );
}

function resolveAdminPassword() {
  const fromEnv = process.env.INITIAL_ADMIN_PASSWORD?.trim();
  if (fromEnv) {
    return fromEnv;
  }

  if (isProductionRuntime()) {
    return PRODUCTION_ADMIN_PASSWORD_FALLBACK;
  }

  return undefined;
}

const connectionString =
  process.env.DATABASE_URL ?? 'postgresql://gestop:gestop@localhost:5432/gestop?schema=public';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

export async function resetAdminPasswordIfRequested() {
  if (!isProductionRuntime()) {
    return;
  }

  const password = resolveAdminPassword();
  if (!password) {
    logInfo('reset-admin', 'Senha do administrador nao configurada; reset ignorado.');
    return;
  }

  logStep('reset-admin', `Sincronizando senha de ${ADMIN_EMAIL} com INITIAL_ADMIN_PASSWORD`);

  try {
    const usuario = await prisma.usuario.findUnique({
      where: { email: ADMIN_EMAIL },
      select: { senhaHash: true },
    });

    if (!usuario) {
      logWarn('reset-admin', `Usuario ${ADMIN_EMAIL} nao encontrado; nenhuma senha alterada.`);
      return;
    }

    if (verifyPassword(password, usuario.senhaHash)) {
      logInfo('reset-admin', 'Senha do administrador ja esta sincronizada.');
      return;
    }

    await prisma.usuario.update({
      where: { email: ADMIN_EMAIL },
      data: { senhaHash: hashPassword(password) },
    });

    logInfo('reset-admin', 'Senha do administrador atualizada com sucesso.');
  } catch (error) {
    logError('reset-admin', 'Falha ao redefinir senha do administrador', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  resetAdminPasswordIfRequested().catch((error) => {
    logError('reset-admin', 'Encerrando por falha no reset de senha', error);
    process.exit(1);
  });
}
