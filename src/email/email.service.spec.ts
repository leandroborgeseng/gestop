import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { Logger } from '@nestjs/common';
import { EmailService } from './email.service';

describe('EmailService', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv, EMAIL_DRIVER: 'log' };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it('envia em modo log sem SMTP', async () => {
    const service = new EmailService();
    const result = await service.send({
      to: 'teste@franca.sp.gov.br',
      subject: 'Teste',
      text: 'Corpo',
    });
    expect(result.delivered).toBe(true);
    expect(result.driver).toBe('log');
  });

  it('detecta SMTP configurado', () => {
    process.env.EMAIL_DRIVER = 'smtp';
    process.env.SMTP_HOST = 'smtp.example.com';
    process.env.EMAIL_FROM = 'gestop@franca.sp.gov.br';
    const service = new EmailService();
    expect(service.isConfigured()).toBe(true);
  });

  it('falha SMTP: log sanitizado sem user/pass vindos do transporter (#320 M0)', async () => {
    const user = 'caixa.teste@exemplo.local';
    const pass = 'FakePass-Nao-Real-123';
    const smtpErr = Object.assign(
      new Error(`Invalid login: 535 5.7.139 Authentication unsuccessful user=${user} ${pass}`),
      { code: 'EAUTH', responseCode: 535, command: 'AUTH LOGIN', response: `535 5.7.139 Authentication unsuccessful for ${user} using ${pass}` },
    );
    const transporter = {
      options: { auth: { user, pass } },
      sendMail: vi.fn().mockRejectedValue(smtpErr),
    };
    const errorSpy = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const service = new EmailService();
    (service as unknown as { resolvedCache: unknown }).resolvedCache = {
      at: Date.now(),
      value: { driver: 'smtp', from: 'gestop@exemplo.local', transporter },
    };

    const result = await service.send({ to: 'dest@exemplo.local', subject: 'T', text: 'C' });

    expect(transporter.sendMail).toHaveBeenCalledOnce();
    expect(result.delivered).toBe(false);
    expect(result.detail).toMatch(/autenticação básica/);
    const logged = errorSpy.mock.calls.map((c) => String(c[0])).join('\n');
    expect(logged).toContain('responseCode=535');
    expect(logged).toContain('status=5.7.139');
    expect(logged).not.toContain(user);
    expect(logged).not.toContain(pass);
    expect(result.detail).not.toContain(pass);
  });
});
