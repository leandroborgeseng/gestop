import { resolve } from 'node:path';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { runWebmapImport } from './webmap-import-core';
import { logError, logInfo, logStep, logWarn, maskDatabaseUrl } from './startup-log';

const connectionString =
  process.env.DATABASE_URL ?? 'postgresql://gestop:gestop@localhost:5432/gestop?schema=public';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const localDirArg = args.find((arg) => arg.startsWith('--local='))?.slice('--local='.length);
  const localDir = localDirArg ? resolve(process.cwd(), localDirArg) : null;

  logStep('webmap', 'CLI import webmap');
  logInfo('webmap', `DATABASE_URL=${maskDatabaseUrl(process.env.DATABASE_URL)}`);
  if (dryRun) logWarn('webmap', 'Modo dry-run');

  await runWebmapImport(prisma, { dryRun, localDir });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    logError('webmap', 'Falha ao importar webmap', error);
    await prisma.$disconnect();
    process.exit(1);
  });
