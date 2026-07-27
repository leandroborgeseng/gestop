const WEAK_JWT_SECRETS = new Set([
  'gestop-dev-secret-change-me',
  'troque-este-segredo-em-producao',
  'change-me',
  'change_me_jwt_secret',
  'change_me_jwt_refresh',
]);

export function isProductionEnv() {
  return process.env.NODE_ENV === 'production';
}

function isManagedDeploy() {
  return (
    Boolean(process.env.RAILWAY_ENVIRONMENT) ||
    Boolean(process.env.RAILWAY_PROJECT_ID) ||
    Boolean(process.env.COOLIFY) ||
    Boolean(process.env.COOLIFY_RESOURCE_UUID) ||
    Boolean(process.env.COOLIFY_CONTAINER_NAME)
  );
}

/** Preenche STORAGE_PUBLIC_URL_BASE a partir de URLs publicas do Coolify/Railway quando ausente. */
export function resolveStoragePublicUrlBase(): string | undefined {
  const explicit = process.env.STORAGE_PUBLIC_URL_BASE?.trim();
  if (explicit) {
    return explicit;
  }

  const frontend =
    process.env.FRONTEND_PUBLIC_URL?.trim() ||
    process.env.APP_PUBLIC_URL?.trim() ||
    process.env.SERVICE_URL_WEB?.trim() ||
    process.env.CORS_ORIGINS?.split(',')[0]?.trim();

  if (!frontend) {
    return undefined;
  }

  const base = frontend.replace(/\/$/, '');
  const resolved = `${base}/api-gestop`;
  process.env.STORAGE_PUBLIC_URL_BASE = resolved;
  return resolved;
}

export function resolveJwtSecret(explicit?: string | null) {
  const secret = explicit?.trim() || process.env.JWT_SECRET?.trim();

  if (isProductionEnv()) {
    if (!secret) {
      throw new Error('[SIGMA:env] JWT_SECRET e obrigatorio em producao.');
    }
    if (secret.length < 32 || WEAK_JWT_SECRETS.has(secret)) {
      throw new Error(
        '[SIGMA:env] JWT_SECRET fraco ou padrao. Use um segredo aleatorio com pelo menos 32 caracteres (openssl rand -base64 48).',
      );
    }
    return secret;
  }

  return secret || 'gestop-dev-secret-change-me';
}

export function assertProductionEnv() {
  if (!isProductionEnv()) {
    return;
  }

  const errors: string[] = [];

  try {
    resolveJwtSecret();
  } catch (error) {
    errors.push(error instanceof Error ? error.message : 'JWT_SECRET invalido.');
  }

  const storageDriver = process.env.STORAGE_DRIVER?.trim() || 'local';
  if (storageDriver === 's3') {
    const required = ['S3_BUCKET', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY', 'S3_PUBLIC_URL_BASE'] as const;
    const missing = required.filter((key) => !process.env[key]?.trim());
    if (missing.length > 0) {
      errors.push(`[SIGMA:env] Variaveis obrigatorias para STORAGE_DRIVER=s3: ${missing.join(', ')}`);
    }
  } else if (storageDriver === 'local') {
    const publicBase = resolveStoragePublicUrlBase();
    if (!publicBase) {
      if (isManagedDeploy()) {
        // Coolify sem dominio ainda: permite boot com URL interna; ajuste STORAGE_PUBLIC_URL_BASE apos DNS
        const fallback = 'http://localhost:3000/api-gestop';
        process.env.STORAGE_PUBLIC_URL_BASE = fallback;
        console.warn(
          `[SIGMA:env] STORAGE_PUBLIC_URL_BASE ausente — usando ${fallback} temporariamente. Defina a URL publica do web + /api-gestop no Coolify.`,
        );
      } else {
        errors.push(
          '[SIGMA:env] STORAGE_PUBLIC_URL_BASE obrigatorio em producao com STORAGE_DRIVER=local (URL publica do frontend + /api-gestop).',
        );
      }
    }

    const localDir = process.env.STORAGE_LOCAL_DIR?.trim();

    if (isManagedDeploy()) {
      if (!localDir) {
        errors.push(
          '[SIGMA:env] STORAGE_LOCAL_DIR obrigatorio em Coolify/Railway (ex.: /data/gestop-evidencias com volume persistente).',
        );
      } else if (!localDir.startsWith('/data/')) {
        errors.push(
          '[SIGMA:env] STORAGE_LOCAL_DIR deve apontar para o volume persistente (/data/gestop-evidencias).',
        );
      }
    }
  }

  if (errors.length > 0) {
    throw new Error(
      `[SIGMA:env] Configuracao de producao incompleta:\n${errors.map((item) => `- ${item}`).join('\n')}`,
    );
  }
}
