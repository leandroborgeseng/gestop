import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { importSecretariasFromFile } from './import-secretarias-core';
import { logError, logInfo, logStep, logWarn, maskDatabaseUrl } from './startup-log';

const connectionString =
  process.env.DATABASE_URL ?? 'postgresql://gestop:gestop@localhost:5432/gestop?schema=public';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const fileArg = args.find((arg) => !arg.startsWith('--'));
  const filePath = resolve(process.cwd(), fileArg ?? 'data/secretarias.template.csv');

  logStep('import', `Importando secretarias de ${filePath}`);
  logInfo('import', `DATABASE_URL=${maskDatabaseUrl(process.env.DATABASE_URL)}`);
  if (dryRun) logWarn('import', 'Modo dry-run: nenhuma alteracao sera persistida.');

  await readFile(filePath, 'utf8');
  const result = await importSecretariasFromFile(prisma, filePath, dryRun);

  logInfo('import', `Importacao concluida: ${result.created} criadas, ${result.updated} atualizadas.`);
  logInfo('import', `Total de secretarias no banco: ${result.total}`);
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (error) => {
    logError('import', 'Falha ao importar secretarias', error);
    await prisma.$disconnect();
    process.exit(1);
  });
