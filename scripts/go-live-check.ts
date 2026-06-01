import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { resolveJwtSecret } from '../src/config/env';
import { logError, logInfo, logStep, logWarn, maskDatabaseUrl } from '../prisma/startup-log';

const connectionString =
  process.env.DATABASE_URL ?? 'postgresql://gestop:gestop@localhost:5432/gestop?schema=public';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

type CheckResult = { ok: boolean; label: string; detail?: string };

async function main() {
  logStep('go-live', 'Verificacao de prontidao para go-live');
  logInfo('go-live', `DATABASE_URL=${maskDatabaseUrl(process.env.DATABASE_URL)}`);

  const checks: CheckResult[] = [];

  try {
    if (process.env.NODE_ENV === 'production') {
      resolveJwtSecret();
      checks.push({ ok: true, label: 'JWT_SECRET configurado' });
    } else {
      checks.push({ ok: true, label: 'Ambiente de desenvolvimento (JWT opcional)' });
    }
  } catch (error) {
    checks.push({
      ok: false,
      label: 'JWT_SECRET',
      detail: error instanceof Error ? error.message : 'invalido',
    });
  }

  if (process.env.STORAGE_PUBLIC_URL_BASE?.trim()) {
    checks.push({ ok: true, label: 'STORAGE_PUBLIC_URL_BASE configurado' });
  } else if (process.env.NODE_ENV === 'production') {
    checks.push({ ok: false, label: 'STORAGE_PUBLIC_URL_BASE ausente' });
  }

  if (process.env.FRONTEND_PUBLIC_URL?.trim()) {
    checks.push({ ok: true, label: 'FRONTEND_PUBLIC_URL configurado' });
  } else if (process.env.NODE_ENV === 'production') {
    checks.push({ ok: false, label: 'FRONTEND_PUBLIC_URL ausente (recuperacao de senha)' });
  }

  if (process.env.SENTRY_DSN?.trim()) {
    checks.push({ ok: true, label: 'SENTRY_DSN configurado (monitoramento)' });
  } else if (process.env.NODE_ENV === 'production') {
    checks.push({
      ok: true,
      label: 'SENTRY_DSN ausente (recomendado em producao)',
      detail: 'Configure Sentry para rastrear erros',
    });
  }

  const vapidOk =
    process.env.WEB_PUSH_VAPID_PUBLIC_KEY?.trim() && process.env.WEB_PUSH_VAPID_PRIVATE_KEY?.trim();
  if (vapidOk) {
    checks.push({ ok: true, label: 'Web Push VAPID configurado' });
  } else if (process.env.NODE_ENV === 'production') {
    checks.push({
      ok: true,
      label: 'Web Push VAPID ausente (opcional)',
      detail: 'Execute npm run vapid:generate',
    });
  }

  const [secretarias, unidades, usuarios, chamados] = await Promise.all([
    prisma.secretaria.count({ where: { ativo: true } }),
    prisma.unidadePublica.count({ where: { ativo: true } }),
    prisma.usuario.count({ where: { ativo: true } }),
    prisma.chamado.count(),
  ]);

  checks.push({
    ok: secretarias >= 3,
    label: `Secretarias ativas (${secretarias})`,
    detail: secretarias >= 9 ? 'Meta 9 secretarias atingida' : 'Importe data/secretarias.template.csv',
  });
  checks.push({
    ok: unidades >= 10,
    label: `Unidades ativas (${unidades})`,
    detail: unidades >= 165 ? 'Base patrimonial completa' : 'Importe CSV oficial (~165)',
  });
  checks.push({
    ok: usuarios >= 1,
    label: `Usuarios ativos (${usuarios})`,
  });
  checks.push({
    ok: true,
    label: `Chamados registrados (${chamados})`,
  });

  const failed = checks.filter((item) => !item.ok);
  for (const check of checks) {
    const prefix = check.ok ? 'OK' : 'FALHA';
    logInfo('go-live', `[${prefix}] ${check.label}${check.detail ? ` — ${check.detail}` : ''}`);
  }

  if (failed.length > 0) {
    logWarn('go-live', `${failed.length} verificacao(oes) pendente(s) antes do go-live.`);
    process.exitCode = 1;
  } else {
    logInfo('go-live', 'Verificacao concluida: pronto para homologacao/go-live.');
  }
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (error) => {
    logError('go-live', 'Falha na verificacao', error);
    await prisma.$disconnect();
    process.exit(1);
  });
