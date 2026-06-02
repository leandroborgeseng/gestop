import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { resolveJwtSecret } from '../src/config/env';
import { logError, logInfo, logStep, logWarn, maskDatabaseUrl } from '../prisma/startup-log';

const connectionString =
  process.env.DATABASE_URL ?? 'postgresql://gestop:gestop@localhost:5432/gestop?schema=public';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

type CheckResult = { ok: boolean; label: string; detail?: string; severity?: 'critical' | 'warn' };

async function main() {
  logStep('go-live', 'Verificacao de prontidao para go-live — Franca/SP');
  logInfo('go-live', `DATABASE_URL=${maskDatabaseUrl(process.env.DATABASE_URL)}`);
  logInfo('go-live', 'Referencia completa: docs/go-live-franca.md');

  const checks: CheckResult[] = [];

  try {
    if (process.env.NODE_ENV === 'production') {
      resolveJwtSecret();
      checks.push({ ok: true, label: 'JWT_SECRET configurado', severity: 'critical' });
    } else {
      checks.push({ ok: true, label: 'Ambiente de desenvolvimento (JWT opcional)' });
    }
  } catch (error) {
    checks.push({
      ok: false,
      label: 'JWT_SECRET',
      detail: error instanceof Error ? error.message : 'invalido',
      severity: 'critical',
    });
  }

  const prod = process.env.NODE_ENV === 'production';

  if (process.env.STORAGE_PUBLIC_URL_BASE?.trim()) {
    checks.push({ ok: true, label: 'STORAGE_PUBLIC_URL_BASE configurado', severity: 'critical' });
  } else if (prod) {
    checks.push({ ok: false, label: 'STORAGE_PUBLIC_URL_BASE ausente', severity: 'critical' });
  }

  if (process.env.FRONTEND_PUBLIC_URL?.trim()) {
    checks.push({ ok: true, label: 'FRONTEND_PUBLIC_URL configurado', severity: 'critical' });
  } else if (prod) {
    checks.push({ ok: false, label: 'FRONTEND_PUBLIC_URL ausente (recuperacao de senha)', severity: 'critical' });
  }

  const emailOk =
    process.env.SMTP_HOST?.trim() ||
    process.env.EMAIL_WEBHOOK_URL?.trim() ||
    (process.env.EMAIL_DRIVER === 'webhook' && process.env.INTEGRACOES_WEBHOOK_URL?.trim());
  if (emailOk) {
    checks.push({ ok: true, label: 'E-mail transacional configurado (SMTP ou webhook)' });
  } else if (prod) {
    checks.push({
      ok: false,
      label: 'E-mail transacional ausente',
      detail: 'Configure EMAIL_DRIVER=smtp + SMTP_* ou webhook',
      severity: 'critical',
    });
  }

  if (process.env.SENTRY_DSN?.trim()) {
    checks.push({ ok: true, label: 'SENTRY_DSN configurado' });
  } else if (prod) {
    checks.push({ ok: true, label: 'SENTRY_DSN ausente (recomendado)', severity: 'warn' });
  }

  const vapidOk =
    process.env.WEB_PUSH_VAPID_PUBLIC_KEY?.trim() && process.env.WEB_PUSH_VAPID_PRIVATE_KEY?.trim();
  if (vapidOk) {
    checks.push({ ok: true, label: 'Web Push VAPID configurado' });
  } else if (prod) {
    checks.push({ ok: true, label: 'Web Push VAPID ausente (opcional)', severity: 'warn' });
  }

  if (process.env.WEBMAP_CRON_SECRET?.trim()) {
    checks.push({ ok: true, label: 'WEBMAP_CRON_SECRET configurado (sync automatica)' });
  } else if (prod) {
    checks.push({
      ok: true,
      label: 'WEBMAP_CRON_SECRET ausente (sync manual apenas)',
      severity: 'warn',
    });
  }

  const [secretarias, unidades, usuarios, chamados, webmapImports] = await Promise.all([
    prisma.secretaria.count({ where: { ativo: true } }),
    prisma.unidadePublica.count({ where: { ativo: true } }),
    prisma.usuario.count({ where: { ativo: true } }),
    prisma.chamado.count(),
    prisma.webmapImport.count({ where: { dryRun: false } }),
  ]);

  checks.push({
    ok: secretarias >= 9,
    label: `Secretarias ativas (${secretarias})`,
    detail: secretarias >= 9 ? 'Template completo' : 'Importe data/secretarias.template.csv ou Secretarias + Webmap',
    severity: secretarias >= 3 ? 'warn' : 'critical',
  });

  checks.push({
    ok: unidades >= 300,
    label: `Unidades ativas (${unidades})`,
    detail:
      unidades >= 300
        ? 'Webmap importado'
        : unidades >= 10
          ? 'Parcial — rode Secretarias + Webmap no painel Admin'
          : 'Importe webmap ou CSV oficial',
    severity: unidades >= 10 ? 'warn' : 'critical',
  });

  checks.push({
    ok: usuarios >= 1,
    label: `Usuarios ativos (${usuarios})`,
    severity: 'critical',
  });

  checks.push({
    ok: true,
    label: `Chamados registrados (${chamados})`,
  });

  checks.push({
    ok: webmapImports >= 1,
    label: `Syncs webmap concluidas (${webmapImports})`,
    detail: webmapImports >= 1 ? undefined : 'Execute importacao no Admin → Importacao',
    severity: 'warn',
  });

  const failedCritical = checks.filter((item) => !item.ok && item.severity === 'critical');
  const failed = checks.filter((item) => !item.ok);

  for (const check of checks) {
    const prefix = check.ok ? 'OK' : check.severity === 'warn' ? 'AVISO' : 'FALHA';
    logInfo('go-live', `[${prefix}] ${check.label}${check.detail ? ` — ${check.detail}` : ''}`);
  }

  if (failedCritical.length > 0) {
    logWarn('go-live', `${failedCritical.length} verificacao(oes) CRITICA(s) pendente(s).`);
    process.exitCode = 1;
  } else if (failed.length > 0) {
    logWarn('go-live', `${failed.length} aviso(s) — revisar antes do piloto (docs/go-live-franca.md).`);
  } else {
    logInfo('go-live', 'Verificacao concluida: pronto para piloto Franca.');
  }
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (error) => {
    logError('go-live', 'Falha na verificacao', error);
    await prisma.$disconnect();
    process.exit(1);
  });
