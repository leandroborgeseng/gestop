import { createHmac, randomBytes, createHash } from 'node:crypto';

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

export function maskCpf(cpf?: string | null) {
  const digits = (cpf ?? '').replace(/\D/g, '');
  if (digits.length < 11) return cpf ? '***.***.***-**' : null;
  return `***.***.***-${digits.slice(-2)}`;
}

export function maskEmail(email?: string | null) {
  const value = (email ?? '').trim();
  if (!value || !value.includes('@')) return email ? '***@***' : null;
  const [user, domain] = value.split('@');
  const visible = user.slice(0, Math.min(2, user.length));
  return `${visible}***@${domain}`;
}

export function buildPublicValidationPath(codigoValidacao: string, codigoVerificador?: string) {
  const base = `/documento/validar/${encodeURIComponent(codigoValidacao)}`;
  return codigoVerificador ? `${base}?v=${encodeURIComponent(codigoVerificador)}` : base;
}

export function buildPublicValidationUrl(codigoValidacao: string, codigoVerificador?: string) {
  const app =
    process.env.PUBLIC_APP_URL?.trim() ||
    process.env.FRONTEND_URL?.trim() ||
    process.env.APP_URL?.trim() ||
    '';
  const path = buildPublicValidationPath(codigoValidacao, codigoVerificador);
  return app ? `${app.replace(/\/$/, '')}${path}` : path;
}
