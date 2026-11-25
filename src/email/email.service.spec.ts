import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { Logger } from '@nestjs/common';
import nodemailer from 'nodemailer';
import { EmailService } from './email.service';
import { M365GraphEmailProvider } from './m365-graph.mailer';

describe('EmailService', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv, EMAIL_DRIVER: 'log' };
    delete process.env.EMAIL_PROVIDER;
    delete process.env.M365_TENANT_ID;
    delete process.env.M365_CLIENT_ID;
    delete process.env.M365_CLIENT_SECRET;
    delete process.env.M365_SENDER;
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

  it('sem envs M365/OAuth2 o boot não falha e o envio segue pelo SMTP', async () => {
    for (const key of [
      'EMAIL_PROVIDER',
      'M365_TENANT_ID',
      'M365_CLIENT_ID',
      'M365_CLIENT_SECRET',
      'M365_SENDER',
      'AZURE_TENANT_ID',
      'AZURE_CLIENT_ID',
      'AZURE_CLIENT_SECRET',
      'ENTRA_TENANT_ID',
      'ENTRA_CLIENT_ID',
      'ENTRA_CLIENT_SECRET',
    ]) {
      delete process.env[key];
    }
    process.env.EMAIL_DRIVER = 'smtp';
    process.env.SMTP_HOST = 'smtp.exemplo.invalid';
    process.env.SMTP_PORT = '587';
    process.env.SMTP_USER = 'caixa.falsa@exemplo.invalid';
    process.env.SMTP_PASSWORD = 'senha-falsa-nao-real';
    process.env.EMAIL_FROM = 'remetente.falso@exemplo.invalid';

    const sendMail = vi.fn().mockResolvedValue({ messageId: 'smtp-local-falso' });
    const createTransport = vi.spyOn(nodemailer, 'createTransport').mockReturnValue({ sendMail } as never);
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('rede não deve ser chamada'));
    const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const error = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

    expect(() => new M365GraphEmailProvider()).not.toThrow();
    const service = new EmailService();

    const result = await service.send({
      to: 'destinatario.falso@exemplo.invalid',
      subject: 'Assunto fictício',
      text: 'Corpo fictício',
    });

    expect(result).toEqual({ delivered: true, driver: 'smtp' });
    expect(createTransport).toHaveBeenCalledWith(
      expect.objectContaining({ host: 'smtp.exemplo.invalid', port: 587 }),
    );
    expect(sendMail).toHaveBeenCalledOnce();
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'remetente.falso@exemplo.invalid',
        to: 'destinatario.falso@exemplo.invalid',
        subject: 'Assunto fictício',
        text: 'Corpo fictício',
      }),
    );
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
  });
});
