const MIN_SECRET_LENGTH = 8;

const DIAGNOSTIC_SECRET_NAMES = [
  'M365_CLIENT_SECRET',
  'M365_CLIENT_ID',
  'M365_TENANT_ID',
  'M365_SENDER',
  'SMTP_PASSWORD',
  'SMTP_USER',
  'EMAIL_FROM',
] as const;

/** Remove segredos conhecidos, Bearer e JWT de um texto antes de log ou resposta. */
export function redactSecrets(input: string, secrets: Array<string | null | undefined> = []): string {
  let out = input;
  for (const secret of secrets) {
    const value = secret?.trim();
    if (!value || value.length < MIN_SECRET_LENGTH) continue;
    out = out.split(value).join('***');
    const encoded = encodeURIComponent(value);
    if (encoded !== value) out = out.split(encoded).join('***');
    const jsonEscaped = JSON.stringify(value).slice(1, -1);
    if (jsonEscaped !== value) out = out.split(jsonEscaped).join('***');
  }
  return out
    .replace(/(bearer\s+)[a-z0-9\-._~+/]+=*/gi, '$1***')
    .replace(/\b(access_token|client_secret|refresh_token|id_token)(\s*[:=]\s*)("[^"]*"|[^\s,&"']+)/gi, '$1$2***')
    .replace(/eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{4,}/g, '***');
}

/** Valores longos do ambiente que o diagnóstico não pode ecoar. Não inclui nomes de variáveis. */
export function diagnosticSecretValues(env: NodeJS.ProcessEnv = process.env): string[] {
  return DIAGNOSTIC_SECRET_NAMES.map((name) => env[name]?.trim() ?? '').filter((value) => value.length >= MIN_SECRET_LENGTH);
}
