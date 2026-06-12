import { access, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { join } from 'node:path';
import { isProductionEnv } from '../config/env';

export function resolveStorageLocalDir() {
  return process.env.STORAGE_LOCAL_DIR?.trim() || join(process.cwd(), 'storage');
}

export function describeStoragePersistenceRisk(localDir: string) {
  const configured = process.env.STORAGE_LOCAL_DIR?.trim();

  if (!isProductionEnv() && !process.env.RAILWAY_ENVIRONMENT) {
    return null;
  }

  if (!configured) {
    return 'STORAGE_LOCAL_DIR nao definido — fotos ficam no disco efemero do container e se perdem a cada redeploy.';
  }

  if (localDir.startsWith('/app/') || localDir === join(process.cwd(), 'storage')) {
    return 'STORAGE_LOCAL_DIR aponta para a pasta da aplicacao (/app) — monte um Volume Railway em /data e use /data/gestop-evidencias.';
  }

  if (!localDir.startsWith('/data/')) {
    return 'Confirme se STORAGE_LOCAL_DIR usa o Volume persistente do Railway (recomendado: /data/gestop-evidencias).';
  }

  return null;
}

export async function inspectStorageHealth() {
  const driver = process.env.STORAGE_DRIVER?.trim() || 'local';

  if (driver !== 'local') {
    return {
      status: 'ok' as const,
      driver,
      message: 'Storage externo configurado.',
    };
  }

  const localDir = resolveStorageLocalDir();
  const probePath = join(localDir, '.health-probe');
  const errors: string[] = [];
  let writable = false;
  let readable = false;

  try {
    await mkdir(localDir, { recursive: true });
    await access(localDir, constants.W_OK | constants.R_OK);
    writable = true;

    const payload = `probe-${Date.now()}`;
    await writeFile(probePath, payload, 'utf8');
    const readBack = await readFile(probePath, 'utf8');
    readable = readBack === payload;
    await rm(probePath, { force: true });
  } catch (error) {
    errors.push(error instanceof Error ? error.message : 'Erro ao validar permissoes do storage');
  }

  const persistentHint = describeStoragePersistenceRisk(localDir);
  const status =
    !writable || !readable || errors.length > 0
      ? ('error' as const)
      : persistentHint
        ? ('warn' as const)
        : ('ok' as const);

  return {
    status,
    driver,
    localDir,
    writable,
    readable,
    publicUrlBase: process.env.STORAGE_PUBLIC_URL_BASE?.trim() ?? null,
    persistentHint,
    errors: errors.length > 0 ? errors : undefined,
  };
}
