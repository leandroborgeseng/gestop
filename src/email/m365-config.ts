export const M365_ENV_NAMES = ['M365_TENANT_ID', 'M365_CLIENT_ID', 'M365_CLIENT_SECRET', 'M365_SENDER'] as const;

export type M365EnvName = (typeof M365_ENV_NAMES)[number];
export type MailFallbackDriver = 'smtp' | 'webhook' | 'log';
export type RequestedEmailProvider = 'm365' | 'smtp' | 'other' | 'unset';
export type ActiveEmailProvider = 'm365' | MailFallbackDriver;

export type EmailTokenProbe = {
  attempted: boolean;
  ok: boolean;
  httpStatus: number | null;
  expiresInSeconds: number | null;
  detail: string;
};

export type EmailDiagnosticReport = {
  /** Classificação de EMAIL_PROVIDER. Nunca devolve o texto cru da variável. */
  providerRequested: RequestedEmailProvider;
  activeProvider: ActiveEmailProvider;
  /** Presença das variáveis do provedor ativo. Não olha a tela de SMTP. */
  configurationComplete: boolean;
  usingFallback: boolean;
  fallbackWarning: string | null;
  m365: {
    selected: boolean;
    complete: boolean;
    present: Record<M365EnvName, boolean>;
    missing: M365EnvName[];
  };
  smtp: {
    SMTP_HOST: boolean;
    SMTP_PORT: boolean;
    SMTP_SECURE: boolean;
    SMTP_USER: boolean;
    SMTP_PASSWORD: boolean;
    EMAIL_FROM: boolean;
  };
  tokenProbe: EmailTokenProbe;
};

export type M365Credentials = {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  sender: string;
};

function present(env: NodeJS.ProcessEnv, name: string): boolean {
  return Boolean(env[name]?.trim());
}

export function requestedEmailProvider(env: NodeJS.ProcessEnv = process.env): RequestedEmailProvider {
  const raw = env.EMAIL_PROVIDER?.trim().toLowerCase() ?? '';
  if (!raw) return 'unset';
  if (raw === 'm365' || raw === 'smtp') return raw;
  return 'other';
}

export function m365Presence(env: NodeJS.ProcessEnv = process.env): Record<M365EnvName, boolean> {
  return {
    M365_TENANT_ID: present(env, 'M365_TENANT_ID'),
    M365_CLIENT_ID: present(env, 'M365_CLIENT_ID'),
    M365_CLIENT_SECRET: present(env, 'M365_CLIENT_SECRET'),
    M365_SENDER: present(env, 'M365_SENDER'),
  };
}

export function missingM365Env(env: NodeJS.ProcessEnv = process.env): M365EnvName[] {
  const flags = m365Presence(env);
  return M365_ENV_NAMES.filter((name) => !flags[name]);
}

export function isM365ConfigComplete(env: NodeJS.ProcessEnv = process.env): boolean {
  return missingM365Env(env).length === 0;
}

/** Credenciais só existem em memória para o pedido de token. Não serializar este objeto. */
export function readM365Credentials(env: NodeJS.ProcessEnv = process.env): M365Credentials | null {
  if (requestedEmailProvider(env) !== 'm365') return null;
  const tenantId = env.M365_TENANT_ID?.trim();
  const clientId = env.M365_CLIENT_ID?.trim();
  const clientSecret = env.M365_CLIENT_SECRET?.trim();
  const sender = env.M365_SENDER?.trim();
  if (!tenantId || !clientId || !clientSecret || !sender) return null;
  return { tenantId, clientId, clientSecret, sender };
}

export function shouldUseM365(env: NodeJS.ProcessEnv = process.env): boolean {
  return readM365Credentials(env) !== null;
}

export function m365FallbackWarning(env: NodeJS.ProcessEnv = process.env): string | null {
  const requested = requestedEmailProvider(env);
  if (requested === 'm365' && !isM365ConfigComplete(env)) {
    return `EMAIL_PROVIDER=m365 com configuração incompleta (faltam: ${missingM365Env(env).join(', ')}). O envio usa o fluxo SMTP, webhook ou log já existente.`;
  }
  if (requested === 'other') {
    return 'EMAIL_PROVIDER inválido. Use smtp ou m365. O envio usa o fluxo SMTP, webhook ou log já existente.';
  }
  return null;
}

export function resolveEnvMailDriver(env: NodeJS.ProcessEnv = process.env): MailFallbackDriver {
  const explicit = env.EMAIL_DRIVER?.trim().toLowerCase();
  if (explicit === 'smtp' || explicit === 'webhook' || explicit === 'log') return explicit;
  if (env.SMTP_HOST?.trim()) return 'smtp';
  const webhook = env.EMAIL_WEBHOOK_URL?.trim() ?? env.INTEGRACOES_WEBHOOK_URL?.trim();
  if (webhook) return 'webhook';
  return 'log';
}

/** Mesma regra histórica do /health, mais Microsoft 365 quando o provedor está completo. */
export function isLivenessEmailConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  if (shouldUseM365(env)) return true;
  return Boolean(
    env.SMTP_HOST?.trim() ||
      env.EMAIL_WEBHOOK_URL?.trim() ||
      (env.EMAIL_DRIVER === 'webhook' && env.INTEGRACOES_WEBHOOK_URL?.trim()),
  );
}

function skippedProbe(detail: string): EmailTokenProbe {
  return { attempted: false, ok: false, httpStatus: null, expiresInSeconds: null, detail };
}

export function buildEmailProviderDiagnostic(
  env: NodeJS.ProcessEnv,
  fallbackDriver: MailFallbackDriver,
): EmailDiagnosticReport {
  const providerRequested = requestedEmailProvider(env);
  const selected = providerRequested === 'm365';
  const complete = isM365ConfigComplete(env);
  const activeProvider: ActiveEmailProvider = shouldUseM365(env) ? 'm365' : fallbackDriver;
  const usingFallback = (providerRequested === 'm365' || providerRequested === 'other') && activeProvider !== 'm365';
  const configurationComplete =
    activeProvider === 'm365'
      ? true
      : activeProvider === 'smtp'
        ? Boolean(env.SMTP_HOST?.trim() && env.EMAIL_FROM?.trim())
        : activeProvider === 'webhook'
          ? Boolean(env.EMAIL_WEBHOOK_URL?.trim() || env.INTEGRACOES_WEBHOOK_URL?.trim())
          : false;
  const probeDetail =
    selected && !complete
      ? 'Fluxo de token não executado: configuração Microsoft 365 incompleta.'
      : providerRequested === 'other'
        ? 'Fluxo de token não executado: EMAIL_PROVIDER inválido. Use smtp ou m365.'
        : 'Fluxo de token não executado: o provedor ativo não é o Microsoft 365.';

  return {
    providerRequested,
    activeProvider,
    configurationComplete,
    usingFallback,
    fallbackWarning: m365FallbackWarning(env),
    m365: {
      selected,
      complete,
      present: m365Presence(env),
      missing: missingM365Env(env),
    },
    smtp: {
      SMTP_HOST: present(env, 'SMTP_HOST'),
      SMTP_PORT: present(env, 'SMTP_PORT'),
      SMTP_SECURE: present(env, 'SMTP_SECURE'),
      SMTP_USER: present(env, 'SMTP_USER'),
      SMTP_PASSWORD: present(env, 'SMTP_PASSWORD'),
      EMAIL_FROM: present(env, 'EMAIL_FROM'),
    },
    tokenProbe: skippedProbe(probeDetail),
  };
}
