import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuditAction } from '@prisma/client';
import { EmailConfigService } from './email-config.service';
import { EmailService } from './email.service';
import type { M365HttpClient } from './m365-graph.mailer';

const SECRET = 'segredo-falso-m365-NAO-REAL';
const TOKEN = 'token-falso-m365-AAAA-NAO-REAL';

describe('POST /admin/email/diagnostico', () => {
  const originalEnv = process.env;

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it('usa a mesma permissão de executar do teste de e-mail', () => {
    const source = readFileSync(join(__dirname, 'email-config.controller.ts'), 'utf8');
    const permission = "@RequireAnyPermissions(...adminTabPermissionKeys('email', 'executar'))";
    expect(source.split(permission).length - 1).toBeGreaterThanOrEqual(2);
    expect(source).toContain("@Post('diagnostico')");
    expect(source).toContain("@Post('teste')");
    expect(source).toContain('@UseGuards(AuthGuard, PermissionsGuard)');
  });

  it('grava auditoria sem segredo nem token e devolve o relatório', async () => {
    process.env = {
      ...originalEnv,
      EMAIL_PROVIDER: 'm365',
      M365_TENANT_ID: '11111111-1111-1111-1111-111111111111',
      M365_CLIENT_ID: '22222222-2222-2222-2222-222222222222',
      M365_CLIENT_SECRET: SECRET,
      M365_SENDER: 'remetente.falso@exemplo.invalid',
    };
    const http: M365HttpClient = async (url) => {
      if (url.includes('sendMail')) throw new Error(`envio ${SECRET} ${TOKEN}`);
      return {
        status: 200,
        headers: { get: () => null },
        text: async () => JSON.stringify({ access_token: TOKEN, expires_in: 1200 }),
      };
    };
    const emailService = new EmailService();
    emailService.useM365Runtime({ http });
    const audit = { record: vi.fn().mockResolvedValue(undefined) };
    const service = new EmailConfigService({} as never, emailService, audit as never);

    const report = await service.diagnosticar({ sub: 'usuario-teste' } as never);

    expect(report.tokenProbe.ok).toBe(true);
    expect(report.tokenProbe.detail).toMatch(/Nenhum e-mail foi enviado/);
    expect(audit.record).toHaveBeenCalledOnce();
    const entry = audit.record.mock.calls[0][0] as { acao: AuditAction; valorNovo: Record<string, unknown> };
    expect(entry.acao).toBe(AuditAction.CREATE);
    expect(entry.valorNovo).toEqual({
      diagnosticoToken: true,
      activeProvider: 'm365',
      configurationComplete: true,
      tokenAttempted: true,
      tokenOk: true,
    });
    const serialized = JSON.stringify({ report, audit: entry });
    expect(serialized).not.toContain(SECRET);
    expect(serialized).not.toContain(TOKEN);
    expect(serialized).not.toContain('remetente.falso@exemplo.invalid');
  });
});
