import { createHmac, randomBytes, createHash } from 'node:crypto';
import { resolvePublicFrontendUrl } from '../config/env';

function secret() {
  return (
    process.env.DOCUMENTO_VALIDACAO_SECRET?.trim() ||
    process.env.JWT_SECRET?.trim() ||
    'sigma-documento-validacao-dev'
  );
}

export function generateCodigoValidacao() {
  return randomBytes(16).toString('hex').toUpperCase();
}

/** Código verificador HMAC curto (não previsível, não sequencial). */
export function generateCodigoVerificador(codigoDocumento: string, codigoValidacao: string) {
  const digest = createHmac('sha256', secret())
    .update(`${codigoDocumento}:${codigoValidacao}`)
    .digest('hex')
    .toUpperCase();
  return digest.slice(0, 12);
}

export function verifyCodigoVerificador(
  codigoDocumento: string,
  codigoValidacao: string,
  codigoVerificador: string,
) {
  const expected = generateCodigoVerificador(codigoDocumento, codigoValidacao);
  const provided = codigoVerificador.trim().toUpperCase();
  if (provided.length !== expected.length) return false;
  // comparação em tempo constante
  let mismatch = 0;
  for (let i = 0; i < expected.length; i++) {
    mismatch |= expected.charCodeAt(i) ^ provided.charCodeAt(i);
  }
  return mismatch === 0;
}

export function sha256Buffer(buffer: Buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

/** Máscara visual de CPF para PDF/telas públicas (ex.: *.938.038-**). */
export function maskCpf(cpf?: string | null) {
  const digits = (cpf ?? '').replace(/\D/g, '');
  if (digits.length < 11) return cpf ? '*.***.***-**' : null;
  return `*.${digits.slice(3, 6)}.${digits.slice(6, 9)}-**`;
}

/** Máscara visual de e-mail para PDF/telas públicas (ex.: pe***@franca.sp.gov.br). */
export function maskEmail(email?: string | null) {
  const value = (email ?? '').trim();
  if (!value || !value.includes('@')) return email ? '***@***' : null;
  const [user, domain] = value.split('@');
  const visible = user.slice(0, Math.min(2, user.length));
  return `${visible}***@${domain}`;
}

/** Exibição segura de CPF da assinatura: mascarado ou “não informado”. */
export function displayAssinanteCpf(opts: {
  cpf?: string | null;
  cpfNaoInformado?: boolean;
}) {
  if (opts.cpfNaoInformado) return 'não informado';
  const digits = (opts.cpf ?? '').replace(/\D/g, '');
  if (!digits) return 'não informado';
  return maskCpf(opts.cpf) ?? 'não informado';
}

/** Exibição segura de e-mail da assinatura: mascarado ou “não informado”. */
export function displayAssinanteEmail(opts: {
  email?: string | null;
  emailNaoInformado?: boolean;
}) {
  if (opts.emailNaoInformado) return 'não informado';
  const value = (opts.email ?? '').trim();
  if (!value) return 'não informado';
  return maskEmail(opts.email) ?? 'não informado';
}

export function buildPublicValidationPath(codigoValidacao: string, codigoVerificador?: string) {
  const base = `/documento/validar/${encodeURIComponent(codigoValidacao)}`;
  return codigoVerificador ? `${base}?v=${encodeURIComponent(codigoVerificador)}` : base;
}

/**
 * URL absoluta pública de validação (QR Code / links externos).
 * Usa FRONTEND_PUBLIC_URL (e fallbacks) — nunca deve ficar só o caminho relativo em produção.
 */
export function buildPublicValidationUrl(codigoValidacao: string, codigoVerificador?: string) {
  const app = resolvePublicFrontendUrl();
  const path = buildPublicValidationPath(codigoValidacao, codigoVerificador);
  if (app) {
    return `${app}${path}`;
  }
  // Desenvolvimento local sem FRONTEND_PUBLIC_URL: ainda gera URL absoluta usável no celular via localhost.
  if (!isProductionLike()) {
    return `http://localhost:3000${path}`;
  }
  return path;
}

function isProductionLike() {
  return (
    process.env.NODE_ENV === 'production' ||
    Boolean(process.env.RAILWAY_ENVIRONMENT) ||
    Boolean(process.env.COOLIFY) ||
    Boolean(process.env.COOLIFY_RESOURCE_UUID)
  );
}

/** Texto curto para exibição em PDF (hash/URL), sem alterar o valor usado no QR. */
export function summarizeForPdfDisplay(value: string, maxChars = 42) {
  const trimmed = value.trim();
  if (trimmed.length <= maxChars) return trimmed;
  return `${trimmed.slice(0, Math.max(1, maxChars - 1))}…`;
}

export function wrapPdfText(text: string, maxCharsPerLine: number): string[] {
  const value = text.trim();
  if (!value) return [];
  if (value.length <= maxCharsPerLine) return [value];

  const lines: string[] = [];
  let remaining = value;
  while (remaining.length > maxCharsPerLine) {
    let breakAt = remaining.lastIndexOf(' ', maxCharsPerLine);
    if (breakAt < Math.floor(maxCharsPerLine * 0.45)) {
      breakAt = maxCharsPerLine;
    }
    lines.push(remaining.slice(0, breakAt).trimEnd());
    remaining = remaining.slice(breakAt).trimStart();
  }
  if (remaining) lines.push(remaining);
  return lines;
}
