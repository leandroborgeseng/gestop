const WEAK_JWT_SECRETS = new Set([
  'gestop-dev-secret-change-me',
  'troque-este-segredo-em-producao',
  'change-me',
]);

export function isProductionEnv() {
  return process.env.NODE_ENV === 'production';
}

export function resolveJwtSecret(explicit?: string | null) {
  const secret = explicit?.trim() || process.env.JWT_SECRET?.trim();

  if (isProductionEnv()) {
    if (!secret) {
      throw new Error('[GestOP:env] JWT_SECRET e obrigatorio em producao.');
    }
    if (secret.length < 32 || WEAK_JWT_SECRETS.has(secret)) {
      throw new Error('[GestOP:env] JWT_SECRET fraco ou padrao. Use um segredo aleatorio com pelo menos 32 caracteres.');
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
      errors.push(`[GestOP:env] Variaveis obrigatorias para STORAGE_DRIVER=s3: ${missing.join(', ')}`);
    }
  } else if (storageDriver === 'local' && !process.env.STORAGE_PUBLIC_URL_BASE?.trim()) {
    errors.push(
      '[GestOP:env] STORAGE_PUBLIC_URL_BASE obrigatorio em producao com STORAGE_DRIVER=local (URL publica do frontend + /api-gestop).',
    );
  }

  if (errors.length > 0) {
    throw new Error(
      `[GestOP:env] Configuracao de producao incompleta:\n${errors.map((item) => `- ${item}`).join('\n')}`,
    );
  }
}
