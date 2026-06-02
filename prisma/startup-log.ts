const PREFIX = '[GestOP:startup]';

export function maskDatabaseUrl(url?: string): string {
  if (!url) {
    return '(nao configurada)';
  }

  try {
    const parsed = new URL(url);
    if (parsed.password) {
      parsed.password = '****';
    }
    return parsed.toString();
  } catch {
    return '(url invalida)';
  }
}

export function logStep(phase: string, message: string) {
  console.log(`${PREFIX} [${phase}] ${message}`);
}

export function logInfo(phase: string, message: string) {
  console.log(`${PREFIX} [${phase}] ${message}`);
}

export function logWarn(phase: string, message: string) {
  console.warn(`${PREFIX} [${phase}] ${message}`);
}

export function logError(phase: string, message: string, error?: unknown) {
  console.error(`${PREFIX} [${phase}] ${message}`);
  if (error !== undefined) {
    if (error instanceof Error) {
      console.error(`${PREFIX} [${phase}] ${error.name}: ${error.message}`);
      if (error.stack) {
        console.error(error.stack);
      }
    } else {
      console.error(`${PREFIX} [${phase}]`, error);
    }
  }
}

export function logEnvSummary() {
  logStep('env', 'Resumo do ambiente de execucao');
  logInfo('env', `GIT_COMMIT=${process.env.RAILWAY_GIT_COMMIT_SHA ?? process.env.GITHUB_SHA ?? '(nao definido)'}`);
  logInfo('env', `NODE_ENV=${process.env.NODE_ENV ?? '(nao definido)'}`);
  logInfo('env', `PORT=${process.env.PORT ?? '(nao definido)'}`);
  logInfo('env', `DATABASE_URL=${maskDatabaseUrl(process.env.DATABASE_URL)}`);
  logInfo('env', `RESET_DATABASE_ON_START=${process.env.RESET_DATABASE_ON_START ?? 'false'}`);
  logInfo('env', `FORCE_DB_RESET=${process.env.FORCE_DB_RESET ?? 'false'}`);
  logInfo('env', `FORCE_SEED_ON_START=${process.env.FORCE_SEED_ON_START ?? 'false'}`);
  logInfo('env', `INITIAL_ADMIN_PASSWORD=${process.env.INITIAL_ADMIN_PASSWORD ? '[definida]' : '(nao definida)'}`);
  logInfo('env', `JWT_SECRET=${summarizeSecret(process.env.JWT_SECRET)}`);
  logInfo('env', `STORAGE_DRIVER=${process.env.STORAGE_DRIVER ?? 'local'}`);
  logInfo('env', `STORAGE_PUBLIC_URL_BASE=${process.env.STORAGE_PUBLIC_URL_BASE ?? '(nao definido)'}`);
  logInfo('env', `PWD=${process.cwd()}`);
}

function summarizeSecret(value?: string) {
  if (!value?.trim()) return '(ausente)';
  return `[definido, ${value.trim().length} caracteres]`;
}

export function isProductionRuntime() {
  return (
    process.env.NODE_ENV === 'production' ||
    Boolean(process.env.RAILWAY_ENVIRONMENT) ||
    Boolean(process.env.RAILWAY_PROJECT_ID)
  );
}

export function ensureProductionRuntimeEnv() {
  if (isProductionRuntime() && process.env.NODE_ENV !== 'production') {
    process.env.NODE_ENV = 'production';
  }
}
