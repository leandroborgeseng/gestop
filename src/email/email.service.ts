import { Injectable, Logger } from '@nestjs/common';
import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

export type SendEmailInput = {
  to: string | string[];
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

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: Transporter | null = null;

  async send(input: SendEmailInput): Promise<SendEmailResult> {
    const driver = this.resolveDriver();

    if (driver === 'log') {
      this.logger.log(`[email:log] Para: ${formatRecipients(input.to)} | ${input.subject}`);
      this.logger.debug(input.text);
      return { delivered: true, driver: 'log' };
    }

    if (driver === 'webhook') {
      return this.sendViaWebhook(input);
    }

    return this.sendViaSmtp(input);
  }

  isConfigured() {
    const driver = this.resolveDriver();
    if (driver === 'log') return false;
    if (driver === 'webhook') return Boolean(this.webhookUrl());
    return Boolean(process.env.SMTP_HOST?.trim() && process.env.EMAIL_FROM?.trim());
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

  private async sendViaSmtp(input: SendEmailInput): Promise<SendEmailResult> {
    const transporter = this.getTransporter();
    if (!transporter) {
      return { delivered: false, driver: 'smtp', detail: 'SMTP incompleto' };
    }

    try {
      await transporter.sendMail({
        from: process.env.EMAIL_FROM?.trim(),
        to: input.to,
        subject: input.subject,
        text: input.text,
        html: input.html ?? undefined,
      });
      return { delivered: true, driver: 'smtp' };
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'erro SMTP';
      this.logger.error(`Falha SMTP: ${detail}`);
      return { delivered: false, driver: 'smtp', detail };
    }
  }

  private getTransporter() {
    if (this.transporter) return this.transporter;

    const host = process.env.SMTP_HOST?.trim();
    const from = process.env.EMAIL_FROM?.trim();
    if (!host || !from) return null;

    const port = Number(process.env.SMTP_PORT ?? 587);
    const secure = process.env.SMTP_SECURE === 'true';
    const user = process.env.SMTP_USER?.trim();
    const pass = process.env.SMTP_PASSWORD?.trim();

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: user && pass ? { user, pass } : undefined,
    });

    return this.transporter;
  }
}

function formatRecipients(to: string | string[]) {
  return Array.isArray(to) ? to.join(', ') : to;
}
