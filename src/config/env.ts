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

  resolveJwtSecret();

  const storageDriver = process.env.STORAGE_DRIVER?.trim() || 's3';
  if (storageDriver === 's3') {
    const required = ['S3_BUCKET', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY'] as const;
    const missing = required.filter((key) => !process.env[key]?.trim());
    if (missing.length > 0) {
      throw new Error(`[GestOP:env] Variaveis obrigatorias para STORAGE_DRIVER=s3: ${missing.join(', ')}`);
    }
  }
}
