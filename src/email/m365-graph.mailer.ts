import type { SendEmailInput, SendEmailResult } from './email.types';
import {
  buildEmailProviderDiagnostic,
  readM365Credentials,
  resolveEnvMailDriver,
  shouldUseM365,
  type EmailDiagnosticReport,
  type EmailTokenProbe,
  type MailFallbackDriver,
} from './m365-config';
import { diagnosticSecretValues, redactSecrets } from './secret-redaction';

const TOKEN_SKEW_MS = 60_000;
const GRAPH_SCOPE = 'https://graph.microsoft.com/.default';

export type M365HttpResponse = {
  status: number;
  headers: { get(name: string): string | null };
  text(): Promise<string>;
};

export type M365HttpClient = (
  url: string,
  init: { method: 'POST'; headers: Record<string, string>; body: string },
) => Promise<M365HttpResponse>;

export type M365Runtime = {
  env?: NodeJS.ProcessEnv;
  http?: M365HttpClient;
  now?: () => number;
};

export interface EmailDeliveryProvider {
  readonly id: 'm365';
  send(input: SendEmailInput): Promise<SendEmailResult>;
  probeToken(): Promise<EmailTokenProbe>;
}

type CachedToken = {
  token: string;
  expiresAt: number;
  expiresInSeconds: number;
};

type TokenSuccess = { ok: true; token: string; expiresInSeconds: number };
type TokenFailure = { ok: false; detail: string; httpStatus?: number };

type MailPost =
  | { network: true }
  | { status: number; retryAfter: string | null; raw: string };

const defaultM365Http: M365HttpClient = async (url, init) => {
  const response = await fetch(url, init);
  return {
    status: response.status,
    headers: { get: (name: string) => response.headers.get(name) },
    text: () => response.text(),
  };
};

function recipientAddresses(value: string | string[] | undefined): string[] {
  const source = Array.isArray(value) ? value : value ? [value] : [];
  const out: string[] = [];
  for (const item of source) {
    for (const part of item.split(/[,;]/)) {
      const address = part.trim();
      if (!/^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/.test(address)) continue;
      if (!out.includes(address)) out.push(address);
    }
  }
  return out;
}

function readExpiresIn(value: unknown): number {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : Number.NaN;
  if (!Number.isFinite(parsed) || parsed <= 0) return 300;
  return parsed;
}

function safeErrorCode(value: unknown): string | null {
  if (typeof value !== 'string' || !/^[A-Za-z0-9._]{1,80}$/.test(value)) return null;
  return value;
}

function tokenErrorCode(raw: string): string | null {
  try {
    const parsed = JSON.parse(raw) as { error?: unknown };
    return safeErrorCode(parsed.error);
  } catch {
    return null;
  }
}

function graphErrorCode(raw: string): string | null {
  try {
    const parsed = JSON.parse(raw) as { error?: { code?: unknown } | string };
    if (typeof parsed.error === 'string') return safeErrorCode(parsed.error);
    if (parsed.error && typeof parsed.error === 'object') return safeErrorCode(parsed.error.code);
  } catch {
    return null;
  }
  return null;
}

function withCode(message: string, code: string | null): string {
  return code ? `${message} (${code})` : message;
}

function retryAfterSeconds(value: string | null): number | null {
  if (!value || !/^\d{1,5}$/.test(value.trim())) return null;
  const seconds = Number(value.trim());
  if (seconds < 0 || seconds > 86_400) return null;
  return seconds;
}

/**
 * Envio pelo Microsoft Graph com credencial de cliente (Entra ID).
 * O token fica só em memória e não entra em log, erro ou diagnóstico.
 */
export class M365GraphEmailProvider implements EmailDeliveryProvider {
  readonly id = 'm365' as const;
  private cached: CachedToken | null = null;

  constructor(private readonly runtime: M365Runtime = {}) {}

  async send(input: SendEmailInput): Promise<SendEmailResult> {
    const to = recipientAddresses(input.to);
    if (to.length === 0) {
      return { delivered: false, driver: 'm365', detail: 'Nenhum destinatário válido.' };
    }

    const first = await this.getToken(false);
    if (!first.ok) return { delivered: false, driver: 'm365', detail: first.detail };

    let outcome = await this.postMail(first.token, input, to);
    if (!('network' in outcome) && outcome.status === 401) {
      this.cached = null;
      const second = await this.getToken(true);
      if (!second.ok) return { delivered: false, driver: 'm365', detail: second.detail };
      outcome = await this.postMail(second.token, input, to);
    }
    return this.interpret(outcome);
  }

  async probeToken(): Promise<EmailTokenProbe> {
    if (!shouldUseM365(this.env())) {
      return {
        attempted: false,
        ok: false,
        httpStatus: null,
        expiresInSeconds: null,
        detail: this.seal('Fluxo de token não executado: configuração Microsoft 365 incompleta.'),
      };
    }
    const got = await this.getToken(true);
    if (!got.ok) {
      return {
        attempted: true,
        ok: false,
        httpStatus: got.httpStatus ?? null,
        expiresInSeconds: null,
        detail: got.detail,
      };
    }
    return {
      attempted: true,
      ok: true,
      httpStatus: 200,
      expiresInSeconds: got.expiresInSeconds,
      detail: 'Token obtido. Nenhum e-mail foi enviado.',
    };
  }

  private env(): NodeJS.ProcessEnv {
    return this.runtime.env ?? process.env;
  }

  private now(): number {
    return this.runtime.now ? this.runtime.now() : Date.now();
  }

  private client(): M365HttpClient {
    return this.runtime.http ?? defaultM365Http;
  }

  private seal(detail: string, extra: Array<string | null | undefined> = []): string {
    return redactSecrets(detail, [...diagnosticSecretValues(this.env()), this.cached?.token, ...extra]);
  }

  private async getToken(force: boolean): Promise<TokenSuccess | TokenFailure> {
    const credentials = readM365Credentials(this.env());
    if (!credentials) {
      return { ok: false, detail: this.seal('Configuração Microsoft 365 incompleta.') };
    }

    const now = this.now();
    if (!force && this.cached && now < this.cached.expiresAt) {
      return { ok: true, token: this.cached.token, expiresInSeconds: this.cached.expiresInSeconds };
    }
    if (force) this.cached = null;

    let response: M365HttpResponse;
    try {
      response = await this.client()(tokenUrl(credentials.tenantId), {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: credentials.clientId,
          client_secret: credentials.clientSecret,
          scope: GRAPH_SCOPE,
          grant_type: 'client_credentials',
        }).toString(),
      });
    } catch {
      return { ok: false, detail: this.seal('Não foi possível contatar o Entra ID para obter o token.') };
    }

    let raw = '';
    try {
      raw = await response.text();
    } catch {
      raw = '';
    }

    if (response.status < 200 || response.status >= 300) {
      return {
        ok: false,
        httpStatus: response.status,
        detail: this.seal(tokenFailureDetail(response.status, raw)),
      };
    }

    let accessToken = '';
    let expiresInSeconds = 300;
    try {
      const parsed = JSON.parse(raw) as { access_token?: unknown; expires_in?: unknown };
      if (typeof parsed.access_token !== 'string' || !parsed.access_token.trim()) {
        return { ok: false, httpStatus: response.status, detail: this.seal('O Entra ID respondeu sem um token utilizável.') };
      }
      accessToken = parsed.access_token;
      expiresInSeconds = readExpiresIn(parsed.expires_in);
    } catch {
      return { ok: false, httpStatus: response.status, detail: this.seal('O Entra ID respondeu sem um token utilizável.') };
    }

    const ttlMs = Math.max(0, expiresInSeconds * 1000 - TOKEN_SKEW_MS);
    this.cached = { token: accessToken, expiresAt: now + ttlMs, expiresInSeconds };
    return { ok: true, token: accessToken, expiresInSeconds };
  }

  private async postMail(token: string, input: SendEmailInput, to: string[]): Promise<MailPost> {
    const credentials = readM365Credentials(this.env());
    if (!credentials) return { network: true };
    try {
      const response = await this.client()(sendUrl(credentials.sender), {
        method: 'POST',
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify(graphMessage(input, to)),
      });
      let raw = '';
      try {
        raw = await response.text();
      } catch {
        raw = '';
      }
      return { status: response.status, retryAfter: response.headers.get('retry-after'), raw };
    } catch {
      return { network: true };
    }
  }

  private interpret(outcome: MailPost): SendEmailResult {
    if ('network' in outcome) {
      return {
        delivered: false,
        driver: 'm365',
        detail: this.seal('Não foi possível contatar o Microsoft Graph. O e-mail não foi enviado.'),
      };
    }

    if (outcome.status === 200 || outcome.status === 202) {
      return { delivered: true, driver: 'm365' };
    }

    const code = graphErrorCode(outcome.raw);
    let detail: string;
    if (outcome.status === 401) {
      detail = withCode(
        'O Microsoft Graph recusou o token (HTTP 401). O e-mail não foi enviado. Revise o aplicativo e o consentimento de administrador. O token não é exibido.',
        code,
      );
    } else if (outcome.status === 403) {
      detail = withCode(
        'O Microsoft Graph negou o envio (HTTP 403). É necessária a permissão de aplicativo Mail.Send com consentimento de administrador.',
        code,
      );
    } else if (outcome.status === 404) {
      detail = withCode('A caixa remetente não foi encontrada no Microsoft Graph (HTTP 404). O e-mail não foi enviado.', code);
    } else if (outcome.status === 429) {
      detail = 'O Microsoft Graph limitou o envio (HTTP 429). O e-mail não foi enviado. Tente de novo mais tarde.';
      const retry = retryAfterSeconds(outcome.retryAfter);
      if (retry !== null) detail += ` Aguarde ${retry} segundos.`;
    } else if (outcome.status >= 500) {
      detail = withCode(`O Microsoft Graph está indisponível (HTTP ${outcome.status}). O e-mail não foi enviado.`, code);
    } else {
      detail = withCode(`O Microsoft Graph recusou o envio (HTTP ${outcome.status}). O e-mail não foi enviado.`, code);
    }

    return { delivered: false, driver: 'm365', detail: this.seal(detail) };
  }
}

export async function diagnoseEmailDelivery(options?: {
  env?: NodeJS.ProcessEnv;
  http?: M365HttpClient;
  now?: () => number;
  fallbackDriver?: MailFallbackDriver;
}): Promise<EmailDiagnosticReport> {
  const env = options?.env ?? process.env;
  const report = buildEmailProviderDiagnostic(env, options?.fallbackDriver ?? resolveEnvMailDriver(env));
  const withProbe =
    report.activeProvider === 'm365'
      ? {
          ...report,
          tokenProbe: await new M365GraphEmailProvider({ env, http: options?.http, now: options?.now }).probeToken(),
        }
      : report;
  return {
    ...withProbe,
    fallbackWarning: withProbe.fallbackWarning ? redactSecrets(withProbe.fallbackWarning, diagnosticSecretValues(env)) : null,
    tokenProbe: {
      ...withProbe.tokenProbe,
      detail: redactSecrets(withProbe.tokenProbe.detail, diagnosticSecretValues(env)),
    },
  };
}

function tokenUrl(tenantId: string): string {
  return `https://login.microsoftonline.com/${encodeURIComponent(tenantId)}/oauth2/v2.0/token`;
}

function sendUrl(sender: string): string {
  return `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(sender)}/sendMail`;
}

function tokenFailureDetail(status: number, raw: string): string {
  const code = tokenErrorCode(raw);
  if (status === 400 || status === 401) {
    return withCode(
      `O Entra ID recusou o pedido de token (HTTP ${status}). Confira o locatário, o aplicativo e o segredo. Nenhum segredo é exibido.`,
      code,
    );
  }
  if (status === 403) {
    return withCode(
      'O Entra ID negou o pedido de token (HTTP 403). O fluxo de credenciais de cliente pode estar bloqueado no locatário.',
      code,
    );
  }
  if (status === 429) {
    return 'O Entra ID limitou a obtenção de token (HTTP 429). Tente de novo mais tarde.';
  }
  if (status >= 500) {
    return `O Entra ID está indisponível (HTTP ${status}). O token não foi obtido.`;
  }
  return withCode(`Falha ao obter token no Entra ID (HTTP ${status}).`, code);
}

function graphMessage(input: SendEmailInput, to: string[]) {
  const html = input.html?.trim();
  const cc = recipientAddresses(input.cc);
  return {
    message: {
      subject: input.subject,
      body: {
        contentType: html ? 'HTML' : 'Text',
        content: html || input.text,
      },
      toRecipients: to.map((address) => ({ emailAddress: { address } })),
      ...(cc.length > 0 ? { ccRecipients: cc.map((address) => ({ emailAddress: { address } })) } : {}),
    },
    saveToSentItems: false,
  };
}
