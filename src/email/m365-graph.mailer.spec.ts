import { afterEach, describe, expect, it, vi } from 'vitest';
import { Logger } from '@nestjs/common';
import { EmailService } from './email.service';
import { diagnoseEmailDelivery, M365GraphEmailProvider, type M365HttpClient, type M365HttpResponse } from './m365-graph.mailer';
import { buildEmailProviderDiagnostic, isLivenessEmailConfigured, shouldUseM365 } from './m365-config';

const TENANT = '11111111-1111-1111-1111-111111111111';
const CLIENT = '22222222-2222-2222-2222-222222222222';
const SECRET = 'segredo-falso-m365-NAO-REAL';
const SENDER = 'remetente.falso@exemplo.invalid';
const TOKEN_A = 'token-falso-m365-AAAA-NAO-REAL';
const TOKEN_B = 'token-falso-m365-BBBB-NAO-REAL';

const message = { to: 'dest@exemplo.invalid', subject: 'Assunto', text: 'Corpo' };

function m365Env(overrides: Record<string, string | undefined> = {}): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {
    EMAIL_PROVIDER: 'm365',
    M365_TENANT_ID: TENANT,
    M365_CLIENT_ID: CLIENT,
    M365_CLIENT_SECRET: SECRET,
    M365_SENDER: SENDER,
  };
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) delete env[key];
    else env[key] = value;
  }
  return env;
}

function httpResult(status: number, body: unknown, headers: Record<string, string> = {}): M365HttpResponse {
  const lower = Object.fromEntries(Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]));
  return {
    status,
    headers: { get: (name: string) => lower[name.toLowerCase()] ?? null },
    text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
  };
}

function expectNoLeak(text: string) {
  for (const secret of [SECRET, TENANT, CLIENT, SENDER, TOKEN_A, TOKEN_B]) {
    expect(text).not.toContain(secret);
  }
  expect(text).not.toMatch(/bearer\s+\S+/i);
  expect(text).not.toMatch(/client_secret\s*[:=]/i);
  expect(text).not.toMatch(/access_token\s*[:=]/i);
}

describe('M365GraphEmailProvider', () => {
  it('envia pelo Graph depois de obter o token', async () => {
    const calls: Array<{ url: string; body: string; authorization?: string }> = [];
    const http: M365HttpClient = async (url, init) => {
      calls.push({ url, body: init.body, authorization: init.headers.authorization });
      if (url.includes('/oauth2/v2.0/token')) {
        return httpResult(200, { access_token: TOKEN_A, expires_in: 3600 });
      }
      return httpResult(202, '');
    };
    const provider = new M365GraphEmailProvider({ env: m365Env(), http });

    const result = await provider.send(message);

    expect(result).toEqual({ delivered: true, driver: 'm365' });
    expect(calls).toHaveLength(2);
    expect(calls[0].url).toBe(`https://login.microsoftonline.com/${TENANT}/oauth2/v2.0/token`);
    expect(calls[0].body).toContain('grant_type=client_credentials');
    expect(calls[0].body).toContain('scope=https%3A%2F%2Fgraph.microsoft.com%2F.default');
    expect(calls[0].body).toContain(encodeURIComponent(SECRET));
    expect(calls[1].url).toBe(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(SENDER)}/sendMail`);
    expect(calls[1].authorization).toBe(`Bearer ${TOKEN_A}`);
    const payload = JSON.parse(calls[1].body) as { saveToSentItems: boolean; message: { subject: string; body: { contentType: string; content: string } } };
    expect(payload.saveToSentItems).toBe(false);
    expect(payload.message.subject).toBe('Assunto');
    expect(payload.message.body).toEqual({ contentType: 'Text', content: 'Corpo' });
    expectNoLeak(JSON.stringify(result));
  });

  it('reutiliza o token em cache e renova quando expira', async () => {
    let now = 1_700_000_000_000;
    let tokenCalls = 0;
    const sendAuth: string[] = [];
    const http: M365HttpClient = async (url, init) => {
      if (url.includes('/oauth2/v2.0/token')) {
        tokenCalls += 1;
        return httpResult(200, { access_token: tokenCalls === 1 ? TOKEN_A : TOKEN_B, expires_in: 120 });
      }
      sendAuth.push(init.headers.authorization ?? '');
      return httpResult(202, '');
    };
    const provider = new M365GraphEmailProvider({ env: m365Env(), http, now: () => now });

    expect((await provider.send(message)).delivered).toBe(true);
    expect((await provider.send(message)).delivered).toBe(true);
    expect(tokenCalls).toBe(1);

    now += 60_000;
    expect((await provider.send(message)).delivered).toBe(true);
    expect(tokenCalls).toBe(2);
    expect(sendAuth).toEqual([`Bearer ${TOKEN_A}`, `Bearer ${TOKEN_A}`, `Bearer ${TOKEN_B}`]);
  });

  it('depois de HTTP 401 obtém outro token e conclui o envio', async () => {
    let tokenCalls = 0;
    let sendCalls = 0;
    const http: M365HttpClient = async (url) => {
      if (url.includes('/oauth2/v2.0/token')) {
        tokenCalls += 1;
        return httpResult(200, { access_token: tokenCalls === 1 ? TOKEN_A : TOKEN_B, expires_in: 3600 });
      }
      sendCalls += 1;
      if (sendCalls === 1) {
        return httpResult(401, { error: { code: 'InvalidAuthenticationToken', message: `bearer ${TOKEN_A} ${SECRET}` } });
      }
      return httpResult(202, '');
    };
    const provider = new M365GraphEmailProvider({ env: m365Env(), http });

    const result = await provider.send(message);

    expect(result.delivered).toBe(true);
    expect(tokenCalls).toBe(2);
    expect(sendCalls).toBe(2);
    expectNoLeak(JSON.stringify(result));
  });

  it('HTTP 401 persistente explica a recusa sem vazar o corpo', async () => {
    let tokenCalls = 0;
    let sendCalls = 0;
    const http: M365HttpClient = async (url) => {
      if (url.includes('/oauth2/v2.0/token')) {
        tokenCalls += 1;
        return httpResult(200, { access_token: tokenCalls === 1 ? TOKEN_A : TOKEN_B, expires_in: 3600 });
      }
      sendCalls += 1;
      return httpResult(401, {
        error: { code: 'InvalidAuthenticationToken', message: `bearer ${TOKEN_A} client_secret=${SECRET} ${SENDER}` },
      });
    };
    const provider = new M365GraphEmailProvider({ env: m365Env(), http });

    const result = await provider.send(message);

    expect(result.delivered).toBe(false);
    expect(result.detail).toMatch(/HTTP 401/);
    expect(result.detail).toMatch(/consentimento de administrador/);
    expect(result.detail).toContain('InvalidAuthenticationToken');
    expect(tokenCalls).toBe(2);
    expect(sendCalls).toBe(2);
    expectNoLeak(result.detail ?? '');
  });

  it('HTTP 403 fala da permissão Mail.Send', async () => {
    const http: M365HttpClient = async (url) => {
      if (url.includes('/oauth2/v2.0/token')) return httpResult(200, { access_token: TOKEN_A, expires_in: 3600 });
      return httpResult(403, { error: { code: 'ErrorAccessDenied', message: SECRET } });
    };
    const result = await new M365GraphEmailProvider({ env: m365Env(), http }).send(message);
    expect(result.delivered).toBe(false);
    expect(result.detail).toMatch(/HTTP 403/);
    expect(result.detail).toMatch(/Mail\.Send/);
    expectNoLeak(result.detail ?? '');
  });

  it('HTTP 429 não repete a chamada e informa a espera', async () => {
    let tokenCalls = 0;
    let sendCalls = 0;
    const http: M365HttpClient = async (url) => {
      if (url.includes('/oauth2/v2.0/token')) {
        tokenCalls += 1;
        return httpResult(200, { access_token: TOKEN_A, expires_in: 3600 });
      }
      sendCalls += 1;
      return httpResult(429, { error: { message: `${SECRET} bearer ${TOKEN_A}` } }, { 'Retry-After': '12' });
    };
    const result = await new M365GraphEmailProvider({ env: m365Env(), http }).send(message);
    expect(result.delivered).toBe(false);
    expect(result.detail).toMatch(/HTTP 429/);
    expect(result.detail).toContain('12');
    expect(tokenCalls).toBe(1);
    expect(sendCalls).toBe(1);
    expectNoLeak(result.detail ?? '');
  });

  it('HTTP 5xx informa indisponibilidade sem o corpo', async () => {
    let sendCalls = 0;
    const http: M365HttpClient = async (url) => {
      if (url.includes('/oauth2/v2.0/token')) return httpResult(200, { access_token: TOKEN_A, expires_in: 3600 });
      sendCalls += 1;
      return httpResult(503, { error: { code: 'UnknownError', message: `${SECRET} ${TOKEN_A} ${TENANT}` } });
    };
    const result = await new M365GraphEmailProvider({ env: m365Env(), http }).send(message);
    expect(result.delivered).toBe(false);
    expect(result.detail).toMatch(/HTTP 503/);
    expect(sendCalls).toBe(1);
    expectNoLeak(result.detail ?? '');
  });

  it('falha de rede não copia a mensagem da exceção', async () => {
    const http: M365HttpClient = async () => {
      throw new Error(`connect ${SECRET} bearer ${TOKEN_A} ${TENANT} ${CLIENT} ${SENDER}`);
    };
    const result = await new M365GraphEmailProvider({ env: m365Env(), http }).send(message);
    expect(result.delivered).toBe(false);
    expect(result.detail).toMatch(/Entra ID/);
    expectNoLeak(result.detail ?? '');
  });

  it('token recusado pelo Entra ID não devolve o corpo', async () => {
    const http: M365HttpClient = async () =>
      httpResult(401, {
        error: 'invalid_client',
        error_description: `Invalid client secret ${SECRET} bearer ${TOKEN_A}`,
      });
    const result = await new M365GraphEmailProvider({ env: m365Env(), http }).send(message);
    expect(result.delivered).toBe(false);
    expect(result.detail).toMatch(/HTTP 401/);
    expect(result.detail).toContain('invalid_client');
    expectNoLeak(result.detail ?? '');
  });
});

describe('diagnoseEmailDelivery', () => {
  it('com M365 completo só pede token e não chama sendMail', async () => {
    const urls: string[] = [];
    const http: M365HttpClient = async (url) => {
      urls.push(url);
      if (url.includes('sendMail')) throw new Error(`sendMail ${SECRET}`);
      return httpResult(200, { access_token: TOKEN_A, expires_in: 3600, token_type: 'Bearer' });
    };
    const report = await diagnoseEmailDelivery({ env: m365Env(), http, fallbackDriver: 'log' });
    expect(report.activeProvider).toBe('m365');
    expect(report.configurationComplete).toBe(true);
    expect(report.m365.complete).toBe(true);
    expect(report.m365.missing).toEqual([]);
    expect(report.tokenProbe).toMatchObject({ attempted: true, ok: true, httpStatus: 200, expiresInSeconds: 3600 });
    expect(report.tokenProbe.detail).toMatch(/Nenhum e-mail foi enviado/);
    expect(urls.some((url) => url.includes('sendMail'))).toBe(false);
    expectNoLeak(JSON.stringify(report));
  });

  it('configuração incompleta não chama a rede e lista só o nome da variável', async () => {
    const http = vi.fn<M365HttpClient>();
    const env = m365Env({ M365_CLIENT_SECRET: undefined });
    const report = buildEmailProviderDiagnostic(env, 'smtp');
    expect(report.activeProvider).toBe('smtp');
    expect(report.usingFallback).toBe(true);
    expect(report.configurationComplete).toBe(false);
    expect(report.m365.missing).toEqual(['M365_CLIENT_SECRET']);
    expect(report.m365.present.M365_CLIENT_SECRET).toBe(false);
    expect(report.m365.present.M365_TENANT_ID).toBe(true);
    expect(report.tokenProbe.attempted).toBe(false);
    expect(report.fallbackWarning).toContain('M365_CLIENT_SECRET');
    expectNoLeak(JSON.stringify(report));
    expect(http).not.toHaveBeenCalled();
    expect(shouldUseM365(env)).toBe(false);
  });

  it('variáveis M365 sem EMAIL_PROVIDER=m365 não ativam o provedor', () => {
    const env = m365Env({ EMAIL_PROVIDER: undefined });
    expect(shouldUseM365(env)).toBe(false);
    expect(isLivenessEmailConfigured(env)).toBe(false);
    const report = buildEmailProviderDiagnostic(env, 'log');
    expect(report.activeProvider).toBe('log');
    expect(report.usingFallback).toBe(false);
    expect(report.tokenProbe.attempted).toBe(false);
    expectNoLeak(JSON.stringify(report));
  });

  it('aceita EMAIL_PROVIDER com espaços e maiúsculas', () => {
    expect(shouldUseM365(m365Env({ EMAIL_PROVIDER: '  M365  ' }))).toBe(true);
  });
});

describe('EmailService com Microsoft 365', () => {
  const originalEnv = process.env;

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it('cai no SMTP quando a configuração M365 está incompleta e avisa sem segredo', async () => {
    process.env = {
      ...originalEnv,
      EMAIL_DRIVER: 'smtp',
      EMAIL_PROVIDER: 'm365',
      M365_TENANT_ID: TENANT,
      M365_CLIENT_ID: CLIENT,
      M365_SENDER: SENDER,
      SMTP_HOST: 'smtp.exemplo.invalid',
      EMAIL_FROM: 'origem.falsa@exemplo.invalid',
    };
    delete process.env.M365_CLIENT_SECRET;
    const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const error = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const sendMail = vi.fn().mockResolvedValue({ messageId: 'local' });
    const http = vi.fn<M365HttpClient>();
    const service = new EmailService();
    service.useM365Runtime({ http });
    (service as unknown as { resolvedCache: unknown }).resolvedCache = {
      at: Date.now(),
      value: { driver: 'smtp', from: 'origem.falsa@exemplo.invalid', transporter: { sendMail } },
    };

    const result = await service.send(message);

    expect(result).toEqual({ delivered: true, driver: 'smtp' });
    expect(sendMail).toHaveBeenCalledOnce();
    expect(http).not.toHaveBeenCalled();
    const logged = [...warn.mock.calls, ...error.mock.calls].map((call) => String(call[0])).join('\n');
    expect(logged).toContain('M365_CLIENT_SECRET');
    expect(logged).toContain('incompleta');
    expectNoLeak(logged);
    expectNoLeak(JSON.stringify(result));
  });

  it('não ecoa um EMAIL_PROVIDER inválido que contenha segredo', async () => {
    process.env = { ...originalEnv, EMAIL_DRIVER: 'log', EMAIL_PROVIDER: SECRET };
    const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const http = vi.fn<M365HttpClient>();
    const service = new EmailService();
    service.useM365Runtime({ http });

    const result = await service.send(message);
    const logged = warn.mock.calls.map((call) => String(call[0])).join('\n');

    expect(result.driver).toBe('log');
    expect(http).not.toHaveBeenCalled();
    expect(logged).toMatch(/inválido/);
    expectNoLeak(logged);
    expectNoLeak(JSON.stringify(await service.diagnoseToken()));
  });

  it('não avisa e não chama o Graph quando o provedor não é m365', async () => {
    process.env = { ...originalEnv, EMAIL_DRIVER: 'log', ...m365Env({ EMAIL_PROVIDER: 'smtp' }) };
    const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const http = vi.fn<M365HttpClient>();
    const service = new EmailService();
    service.useM365Runtime({ http });

    const result = await service.send(message);

    expect(result.driver).toBe('log');
    expect(http).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
  });

  it('não deixa segredo ou token em log nem no erro quando o Graph falha', async () => {
    process.env = { ...originalEnv, ...m365Env() };
    const error = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const log = vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    const http: M365HttpClient = async (url) => {
      if (url.includes('/oauth2/v2.0/token')) {
        return httpResult(401, { error: 'invalid_client', error_description: `${SECRET} bearer ${TOKEN_A} ${TENANT}` });
      }
      throw new Error(`nao deveria enviar ${SECRET}`);
    };
    const service = new EmailService();
    service.useM365Runtime({ http });

    const result = await service.send(message);
    const report = await service.diagnoseToken();
    const logged = [...error.mock.calls, ...warn.mock.calls, ...log.mock.calls].map((call) => String(call[0])).join('\n');

    expect(result.delivered).toBe(false);
    expect(result.driver).toBe('m365');
    expectNoLeak(result.detail ?? '');
    expectNoLeak(logged);
    expectNoLeak(JSON.stringify(report));
    expect(report.tokenProbe.attempted).toBe(true);
    expect(report.tokenProbe.ok).toBe(false);
    expect(report.tokenProbe.detail).toMatch(/HTTP 401/);
  });
});
