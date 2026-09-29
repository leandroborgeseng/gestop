import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import type { Transporter } from 'nodemailer';
import { PrismaService } from '../prisma/prisma.service';
import {
  buildSmtpTransport,
  decryptEmailPassword,
  explainSmtpError,
  mensagemEmailNaoConfigurado,
} from './email-transport';

export type SendEmailInput = {
  to: string | string[];
  cc?: string | string[];
  subject: string;
  text: string;
  html?: string;
  tags?: string[];
};

export type SendEmailResult = {
  delivered: boolean;
  driver: 'smtp' | 'webhook' | 'log';
  detail?: string;
};

type ResolvedMail = {
  driver: 'smtp' | 'webhook' | 'log';
  from?: string;
  replyTo?: string | null;
  transporter?: Transporter;
  assuntoEquipe?: string | null;
  textoIntroEquipe?: string | null;
  disabled?: boolean;
};

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private resolvedCache: { at: number; value: ResolvedMail } | null = null;

  constructor(@Optional() @Inject(PrismaService) private readonly prisma?: PrismaService) {}

  invalidate() {
    this.resolvedCache = null;
  }

  async send(input: SendEmailInput): Promise<SendEmailResult> {
    const resolved = await this.resolve();
    if (resolved.disabled) {
      return { delivered: false, driver: 'smtp', detail: mensagemEmailNaoConfigurado() };
    }

    const driver = resolved.driver;

    if (driver === 'log') {
      this.logger.log(`[email:log] Para: ${formatRecipients(input.to)} | ${input.subject}`);
      this.logger.debug(input.text);
      return { delivered: true, driver: 'log' };
    }

    if (driver === 'webhook') {
      return this.sendViaWebhook(input);
    }

    return this.sendViaSmtp(input, resolved);
  }

  isConfigured() {
    const driver = this.resolveDriver();
    if (driver === 'log') return false;
    if (driver === 'webhook') return Boolean(this.webhookUrl());
    return Boolean(process.env.SMTP_HOST?.trim() && process.env.EMAIL_FROM?.trim());
  }

  async getEquipeTemplate() {
    const resolved = await this.resolve();
    return {
      subject: resolved.assuntoEquipe?.trim() || 'Novo chamado atribuído à equipe',
      intro: resolved.textoIntroEquipe?.trim() || '',
    };
  }

  private resolveDriver(): 'smtp' | 'webhook' | 'log' {
    const explicit = process.env.EMAIL_DRIVER?.trim().toLowerCase();
    if (explicit === 'smtp' || explicit === 'webhook' || explicit === 'log') {
      return explicit;
    }

    if (process.env.SMTP_HOST?.trim()) return 'smtp';
    if (this.webhookUrl()) return 'webhook';
    return 'log';
  }

  private webhookUrl() {
    return process.env.EMAIL_WEBHOOK_URL?.trim() ?? process.env.INTEGRACOES_WEBHOOK_URL?.trim() ?? null;
  }

  private async sendViaWebhook(input: SendEmailInput): Promise<SendEmailResult> {
    const url = this.webhookUrl();
    if (!url) {
      return { delivered: false, driver: 'webhook', detail: 'Webhook nao configurado' };
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        source: 'gestop',
        evento: 'email.transacional',
        payload: {
          to: input.to,
          cc: input.cc ?? null,
          subject: input.subject,
          text: input.text,
          html: input.html ?? null,
          tags: input.tags ?? [],
        },
        emittedAt: new Date().toISOString(),
      }),
    });

    if (!response.ok) {
      this.logger.warn(`Webhook email falhou: HTTP ${response.status}`);
      return { delivered: false, driver: 'webhook', detail: `HTTP ${response.status}` };
    }

    return { delivered: true, driver: 'webhook' };
  }

  private async sendViaSmtp(input: SendEmailInput, resolved: ResolvedMail): Promise<SendEmailResult> {
    if (!resolved.transporter || !resolved.from) {
      return { delivered: false, driver: 'smtp', detail: mensagemEmailNaoConfigurado() };
    }

    try {
      await resolved.transporter.sendMail({
        from: resolved.from,
        replyTo: resolved.replyTo || undefined,
        to: input.to,
        cc: input.cc,
        subject: input.subject,
        text: input.text,
        html: input.html ?? undefined,
      });
      return { delivered: true, driver: 'smtp' };
    } catch (error) {
      const detail = explainSmtpError(error);
      this.logger.error(`Falha SMTP: ${detail}`);
      return { delivered: false, driver: 'smtp', detail };
    }
  }

  private async resolve(): Promise<ResolvedMail> {
    const agora = Date.now();
    if (this.resolvedCache && agora - this.resolvedCache.at < 60_000) {
      return this.resolvedCache.value;
    }
    const fromDb = await this.resolveFromDatabase();
    const value = fromDb ?? this.resolveFromEnv();
    this.resolvedCache = { at: agora, value };
    return value;
  }

  private async resolveFromDatabase(): Promise<ResolvedMail | null> {
    if (!this.prisma) return null;
    const row = await this.prisma.configuracaoEmail.findUnique({ where: { id: 'default' } });
    if (!row) return null;
    const cadastrada = Boolean(row.smtpHost || row.remetenteEmail || row.senhaEnc);
    if (!row.ativo) {
      return cadastrada ? { driver: 'smtp', disabled: true } : null;
    }
    if (!row.smtpHost || !row.remetenteEmail) {
      return { driver: 'smtp', disabled: true };
    }
    const seguranca = row.seguranca === 'SSL' || row.seguranca === 'NENHUMA' ? row.seguranca : 'TLS';
    const senha = row.senhaEnc ? decryptEmailPassword(row.senhaEnc) : null;
    const from = row.remetenteNome?.trim()
      ? `"${row.remetenteNome.trim().replace(/"/g, '')}" <${row.remetenteEmail}>`
      : row.remetenteEmail;
    return {
      driver: 'smtp',
      from,
      replyTo: row.replyTo,
      assuntoEquipe: row.assuntoEquipe,
      textoIntroEquipe: row.textoIntroEquipe,
      transporter: buildSmtpTransport({
        host: row.smtpHost,
        port: row.smtpPort,
        seguranca,
        usarAutenticacao: row.usarAutenticacao,
        usuario: row.usuario,
        senha,
      }),
    };
  }

  private resolveFromEnv(): ResolvedMail {
    const driver = this.resolveDriver();
    if (driver !== 'smtp') {
      return { driver };
    }
    const host = process.env.SMTP_HOST?.trim();
    const from = process.env.EMAIL_FROM?.trim();
    if (!host || !from) {
      return { driver: 'smtp', disabled: true };
    }
    const user = process.env.SMTP_USER?.trim();
    const pass = process.env.SMTP_PASSWORD?.trim();
    const secure = process.env.SMTP_SECURE === 'true';
    return {
      driver: 'smtp',
      from,
      transporter: buildSmtpTransport({
        host,
        port: Number(process.env.SMTP_PORT ?? 587),
        seguranca: secure ? 'SSL' : 'TLS',
        usarAutenticacao: Boolean(user && pass),
        usuario: user,
        senha: pass,
      }),
    };
  }
}

function formatRecipients(to: string | string[]) {
  return Array.isArray(to) ? to.join(', ') : to;
}
