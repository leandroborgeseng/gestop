import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { decryptSecret } from '../backup/backup-crypto';

export const MENSAGEM_EMAIL_NAO_CONFIGURADO =
  'Envio de e-mail não configurado. Configure os dados de e-mail em Administração > E-mail.';

export function mensagemEmailNaoConfigurado() {
  return MENSAGEM_EMAIL_NAO_CONFIGURADO;
}

export function explainSmtpError(error: unknown) {
  const raw = error instanceof Error ? error.message : 'Falha ao enviar e-mail.';
  const text = raw.toLowerCase();
  if (text.includes('invalid login') || text.includes('authentication') || text.includes('535') || text.includes('534')) {
    return 'Falha de autenticação. Confira usuário e senha de aplicativo.';
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
