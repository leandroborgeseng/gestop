import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
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
});
