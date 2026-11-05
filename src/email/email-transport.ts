import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { decryptSecret } from '../backup/backup-crypto';

export const MENSAGEM_EMAIL_NAO_CONFIGURADO =
  'Envio de e-mail não configurado. Configure os dados de e-mail em Administração > E-mail.';

export function mensagemEmailNaoConfigurado() {
  return MENSAGEM_EMAIL_NAO_CONFIGURADO;
}

export type SmtpErrorInfo = {
  /** Mensagem amigável para a UI (pt-BR). */
  mensagem: string;
  /** Diagnóstico técnico sanitizado para log (sem credencial). */
  tecnico: string;
  code?: string;
  responseCode?: number;
  command?: string;
  enhancedStatus?: string;
};

/**
 * Remove de um texto do servidor qualquer coisa que possa ser credencial:
 * blobs base64 (AUTH PLAIN/LOGIN/XOAUTH2), pares user=/pass=/password=/senha=/token=
 * e cabeçalhos Bearer.
 */
export function sanitizeSmtpText(input: string, secrets: Array<string | null | undefined> = []): string {
  let out = input;
  for (const secret of secrets) {
    if (secret && secret.length >= 3) out = out.split(secret).join('***');
  }
  out = out
    .replace(/(bearer\s+)[^\s"']+/gi, '$1***')
    .replace(/\b(pass(word)?|senha|pwd|token|secret|auth=?|user)\s*[:=]\s*[^\s,;"']+/gi, '$1=***')
    .replace(/\bAUTH\s+(PLAIN|LOGIN|XOAUTH2)\s+\S+/gi, 'AUTH $1 ***')
    .replace(/[A-Za-z0-9+/]{24,}={0,2}/g, '***');
  return out.replace(/\s+/g, ' ').trim().slice(0, 500);
}

function friendlyMessage(text: string, responseCode?: number, enhanced?: string): string {
  // Microsoft 365 / Exchange Online: códigos aprimorados específicos.
  if (enhanced === '5.7.139' || text.includes('basic authentication is disabled') || text.includes('smtpclientauthentication is disabled')) {
    return 'O servidor recusou a autenticação básica (SMTP AUTH desabilitado na conta/locatário Microsoft 365). Não é necessariamente senha errada: habilite SMTP AUTH na caixa ou use OAuth2.';
  }
  if (enhanced === '5.7.57' || text.includes('client was not authenticated to send')) {
    return 'O servidor exige autenticação antes de enviar. Ative "Usar autenticação" e confira a porta 587 com TLS.';
  }
  if (enhanced === '5.7.9' || text.includes('application-specific password') || text.includes('web login required')) {
    return 'O provedor exige senha de aplicativo ou login web/MFA para esta conta.';
  }
  if (enhanced === '5.7.60' || text.includes('sendasdenied') || text.includes('not allowed to send as')) {
    return 'Remetente não autorizado: a conta autenticada não tem permissão para enviar como este endereço.';
  }
  if (enhanced === '5.7.3' || enhanced === '5.7.8' || text.includes('username and password not accepted') || text.includes('authentication unsuccessful') || text.includes('authentication failed')) {
    return 'Usuário ou senha recusados pelo servidor. Confira as credenciais (ou se a conta está bloqueada/expirada).';
  }
  if (responseCode === 535 || responseCode === 534 || text.includes('authentication')) {
    return `Falha de autenticação no servidor SMTP (código ${responseCode ?? 'desconhecido'}). Veja o diagnóstico técnico no log.`;
  }
  if (text.includes('enotfound') || text.includes('getaddrinfo') || text.includes('ebadname')) {
    return 'Servidor SMTP inválido.';
  }
  if (text.includes('econnrefused')) {
    return 'Conexão recusada. Verifique a porta e se o servidor aceita conexão.';
  }
  if (text.includes('timeout') || text.includes('etimedout') || text.includes('esocket')) {
    return 'Tempo esgotado ao conectar no servidor SMTP.';
  }
  if (text.includes('blocked') || text.includes('econnreset')) {
    return 'Conexão bloqueada pelo servidor SMTP.';
  }
  if (text.includes('sender') || text.includes('relay') || text.includes('not allowed')) {
    return 'Remetente não autorizado pelo servidor.';
  }
  return 'Não foi possível enviar o e-mail. Revise servidor, porta e segurança.';
}

export function describeSmtpError(error: unknown, secrets: Array<string | null | undefined> = []): SmtpErrorInfo {
  const e = (error ?? {}) as { message?: unknown; code?: unknown; responseCode?: unknown; command?: unknown; response?: unknown };
  const message = typeof e.message === 'string' ? e.message : 'Falha ao enviar e-mail.';
  const response = typeof e.response === 'string' ? e.response : '';
  const code = typeof e.code === 'string' ? e.code : undefined;
  const responseCode = typeof e.responseCode === 'number' ? e.responseCode : undefined;
  const command = typeof e.command === 'string' ? e.command.split(/\s+/).slice(0, 2).join(' ') : undefined;
  const source = `${response} ${message}`;
  const enhancedStatus = source.match(/\b([245]\.\d{1,3}\.\d{1,3})\b/)?.[1];
  const mensagem = friendlyMessage(source.toLowerCase(), responseCode, enhancedStatus);
  const partes = [
    code && `code=${code}`,
    responseCode !== undefined && `responseCode=${responseCode}`,
    enhancedStatus && `status=${enhancedStatus}`,
    command && `command=${sanitizeSmtpText(command, secrets)}`,
    `response="${sanitizeSmtpText(response || message, secrets)}"`,
  ].filter(Boolean);
  return { mensagem, tecnico: partes.join(' '), code, responseCode, command, enhancedStatus };
}

export function explainSmtpError(error: unknown) {
  return describeSmtpError(error).mensagem;
}

export function buildSmtpTransport(input: {
  host: string;
  port: number;
  seguranca: 'NENHUMA' | 'SSL' | 'TLS';
  usarAutenticacao: boolean;
  usuario?: string | null;
  senha?: string | null;
}): Transporter {
  const secure = input.seguranca === 'SSL';
  return nodemailer.createTransport({
    host: input.host,
    port: input.port,
    secure,
    requireTLS: input.seguranca === 'TLS',
    ignoreTLS: input.seguranca === 'NENHUMA',
    auth:
      input.usarAutenticacao && input.usuario && input.senha
        ? { user: input.usuario, pass: input.senha }
        : undefined,
  });
}

export function decryptEmailPassword(senhaEnc: string | null) {
  if (!senhaEnc) return null;
  return decryptSecret(senhaEnc);
}
