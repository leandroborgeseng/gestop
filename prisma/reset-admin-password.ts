import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/auth/password';
import { logError, logInfo, logStep, logWarn } from './startup-log';

const ADMIN_EMAIL = 'admin.gestop@franca.sp.gov.br';

const connectionString =
  process.env.DATABASE_URL ?? 'postgresql://gestop:gestop@localhost:5432/gestop?schema=public';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

export async function resetAdminPasswordIfRequested() {
  if (process.env.RESET_ADMIN_PASSWORD_ON_START !== 'true') {
    return;
  }

  const password = process.env.INITIAL_ADMIN_PASSWORD?.trim();
  if (!password) {
    throw new Error('RESET_ADMIN_PASSWORD_ON_START=true requer INITIAL_ADMIN_PASSWORD definida.');
  }

  logStep('reset-admin', `Redefinindo senha de ${ADMIN_EMAIL}`);

  try {
    const result = await prisma.usuario.updateMany({
      where: { email: ADMIN_EMAIL },
      data: { senhaHash: hashPassword(password) },
    });

    if (result.count === 0) {
      logWarn('reset-admin', `Usuario ${ADMIN_EMAIL} nao encontrado; nenhuma senha alterada.`);
      return;
    }

    logInfo('reset-admin', 'Senha do administrador atualizada com sucesso.');
    logWarn(
      'reset-admin',
      'Remova RESET_ADMIN_PASSWORD_ON_START (ou defina false) apos confirmar o login.',
    );
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
