import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { importSecretariasFromCsvContent } from './import-secretarias-core';
import { isProductionRuntime, logError, logInfo, logStep, logWarn } from './startup-log';
import { runWebmapImport } from './webmap-import-core';
import { persistWebmapImportResult } from './webmap-import-persist';

const SECRETARIAS_TEMPLATE = resolve(process.cwd(), 'data/secretarias.template.csv');

function isAutoImportEnabled() {
  return process.env.WEBMAP_AUTO_IMPORT_ON_START !== 'false';
}

function minUnitsThreshold() {
  const parsed = Number(process.env.WEBMAP_AUTO_IMPORT_MIN_UNITS ?? '10');
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 10;
}

export async function runStartupWebmapImportIfNeeded() {
  if (!isAutoImportEnabled()) {
    logInfo('startup-import', 'WEBMAP_AUTO_IMPORT_ON_START=false; importacao automatica ignorada.');
    return;
  }

  if (!isProductionRuntime()) {
    logInfo('startup-import', 'Ambiente local: importacao automatica do webmap ignorada.');
    return;
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    logWarn('startup-import', 'DATABASE_URL ausente; importacao automatica ignorada.');
    return;
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });

  try {
    const minUnits = minUnitsThreshold();
    const [lastImport, unidadesAtivas] = await Promise.all([
      prisma.webmapImport.findFirst({
        where: { dryRun: false },
        orderBy: { createdAt: 'desc' },
        select: { githubCommitSha: true, createdAt: true },
      }),
      prisma.unidadePublica.count({ where: { ativo: true } }),
    ]);

    if (unidadesAtivas >= minUnits) {
      const commitInfo = lastImport
        ? `commit ${lastImport.githubCommitSha.slice(0, 7)}, importado em ${lastImport.createdAt.toISOString()}`
        : 'importacao anterior detectada pelos registros no banco';
      logInfo(
        'startup-import',
        `Dados persistidos no banco: ${unidadesAtivas} unidades ativas (${commitInfo}). Nenhuma reimportacao necessaria.`,
      );
      return;
    }

    const reason = !lastImport
      ? 'nenhuma importacao registrada'
      : `apenas ${unidadesAtivas} unidade(s) ativa(s)`;

    logStep('startup-import', `Importacao automatica do webmap necessaria: ${reason}.`);
    logInfo('startup-import', 'Secretarias e unidades serao carregadas do GitHub SMMAFRANCA/webmap.');

    const secretariasCsv = await readFile(SECRETARIAS_TEMPLATE, 'utf8');
    const secretarias = await importSecretariasFromCsvContent(prisma, secretariasCsv, false);
    logInfo(
      'startup-import',
      `Secretarias sincronizadas: ${secretarias.total} cadastradas (${secretarias.created} novas, ${secretarias.updated} atualizadas).`,
    );

    const result = await runWebmapImport(
      prisma,
      { deactivateMissing: true },
      'cron',
      lastImport?.githubCommitSha ?? null,
    );

    await persistWebmapImportResult(prisma, result, { triggeredBy: 'cron' });

    logInfo(
      'startup-import',
      `Importacao concluida: ${result.totalUnidadesInDb} unidades no banco, ${result.created} criadas, ${result.updated} atualizadas (commit ${result.github.commitSha.slice(0, 7)}).`,
    );

    if (result.layersFailed > 0) {
      logWarn('startup-import', `${result.layersFailed} camada(s) falharam durante a importacao.`);
    }
  } catch (error) {
    logError('startup-import', 'Falha na importacao automatica do webmap', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}
