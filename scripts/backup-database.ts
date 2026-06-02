import { spawnSync } from 'node:child_process';
import { mkdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { logError, logInfo, logStep, logWarn, maskDatabaseUrl } from '../prisma/startup-log';

function main() {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    logError('backup', 'DATABASE_URL nao definida.');
    process.exit(1);
  }

  const outputDir = resolve(process.cwd(), process.env.BACKUP_DIR?.trim() || 'backups');
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outputFile = resolve(outputDir, `gestop-${timestamp}.sql`);

  logStep('backup', 'Gerando dump PostgreSQL');
  logInfo('backup', `DATABASE_URL=${maskDatabaseUrl(databaseUrl)}`);
  logInfo('backup', `Arquivo: ${outputFile}`);

  const pgDump = process.env.PG_DUMP_PATH?.trim() || 'pg_dump';
  const result = spawnSync(pgDump, ['--dbname', databaseUrl, '--file', outputFile, '--no-owner', '--no-acl'], {
    encoding: 'utf8',
  });

  if (result.error?.message?.includes('ENOENT')) {
    logWarn('backup', 'pg_dump nao encontrado localmente.');
    logInfo('backup', 'Alternativas:');
    logInfo('backup', '1. Railway Dashboard → Postgres → Backups (recomendado em producao)');
    logInfo('backup', '2. Instale PostgreSQL client: brew install libpq && brew link --force libpq');
    logInfo('backup', '3. Railway CLI: railway connect Postgres');
    process.exit(1);
  }

  if (result.status !== 0) {
    logError('backup', result.stderr || 'pg_dump falhou');
    process.exit(result.status ?? 1);
  }

  logInfo('backup', 'Backup concluido com sucesso.');
  logInfo('backup', 'Agende execucao semanal (cron Railway ou CI) e teste restauracao em ambiente de homologacao.');
}

main();
