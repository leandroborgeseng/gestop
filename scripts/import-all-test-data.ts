import { execSync } from 'node:child_process';
import { resolve } from 'node:path';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { runWebmapImport } from '../prisma/webmap-import-core';
import { logError, logInfo, logStep, logWarn, maskDatabaseUrl } from '../prisma/startup-log';

const connectionString =
  process.env.DATABASE_URL ?? 'postgresql://gestop:gestop@localhost:5432/gestop?schema=public';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const skipSecretarias = args.includes('--skip-secretarias');

  logStep('import-all', 'Importacao completa de dados de teste (secretarias + webmap QGIS)');
  logInfo('import-all', `DATABASE_URL=${maskDatabaseUrl(process.env.DATABASE_URL)}`);
  if (dryRun) logWarn('import-all', 'Modo dry-run parcial (webmap simula; secretarias roda dry-run separado).');

  if (!skipSecretarias) {
    logStep('import-all', 'Importando secretarias template');
    const secretariasFile = resolve(process.cwd(), 'data/secretarias.template.csv');
    execSync(`npx tsx prisma/import-secretarias.ts ${dryRun ? '--dry-run' : ''} "${secretariasFile}"`, {
      stdio: 'inherit',
      env: process.env,
    });
  }

  logStep('import-all', 'Importando unidades do webmap GitHub (38 camadas)');
  const result = await runWebmapImport(prisma, { dryRun });

  logInfo(
    'import-all',
    `Concluido: ${result.uniqueUnits} unicas, ${result.created} criadas, ${result.updated} atualizadas, total DB=${result.totalUnidadesInDb}`,
  );
  logInfo('import-all', `GitHub ${result.github.commitSha.slice(0, 7)} — ${result.github.commitMessage}`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    logError('import-all', 'Falha na importacao completa', error);
    await prisma.$disconnect();
    process.exit(1);
  });
