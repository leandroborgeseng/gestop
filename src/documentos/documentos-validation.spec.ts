import { afterEach, describe, expect, it } from 'vitest';
import {
  buildPublicValidationUrl,
  displayAssinanteCpf,
  displayAssinanteEmail,
  maskCpf,
  maskEmail,
  summarizeForPdfDisplay,
  wrapPdfText,
} from './documentos-validation';

describe('documentos-validation urls', () => {
  const previous = {
    FRONTEND_PUBLIC_URL: process.env.FRONTEND_PUBLIC_URL,
    PUBLIC_APP_URL: process.env.PUBLIC_APP_URL,
    APP_PUBLIC_URL: process.env.APP_PUBLIC_URL,
    SERVICE_URL_WEB: process.env.SERVICE_URL_WEB,
    CORS_ORIGINS: process.env.CORS_ORIGINS,
    NODE_ENV: process.env.NODE_ENV,
  };

  afterEach(() => {
    for (const [key, value] of Object.entries(previous)) {
      if (value == null) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it('monta URL absoluta com FRONTEND_PUBLIC_URL', () => {
    process.env.FRONTEND_PUBLIC_URL = 'https://gestop.up.railway.app/';
    delete process.env.PUBLIC_APP_URL;
    delete process.env.APP_PUBLIC_URL;
    delete process.env.SERVICE_URL_WEB;
    delete process.env.CORS_ORIGINS;

    const url = buildPublicValidationUrl('ABC123', 'VERIF456');
    expect(url).toBe('https://gestop.up.railway.app/documento/validar/ABC123?v=VERIF456');
  });

  it('resume hash e URL para o PDF sem perder prefixo', () => {
    expect(summarizeForPdfDisplay('0123456789ABCDEF0123', 16)).toBe('0123456789ABCDE…');
    expect(summarizeForPdfDisplay('curto', 16)).toBe('curto');
  });

  it('quebra linhas longas para o bloco de autenticidade', () => {
    const lines = wrapPdfText('https://gestop.up.railway.app/documento/validar/ABCDEF1234567890?v=XYZ', 40);
    expect(lines.length).toBeGreaterThan(1);
    expect(lines.every((line) => line.length <= 40)).toBe(true);
  });

  it('mascara CPF e e-mail para exibição pública', () => {
    expect(maskCpf('215.938.038-99')).toBe('*.938.038-**');
    expect(maskEmail('peterson@franca.sp.gov.br')).toBe('pe***@franca.sp.gov.br');
    expect(displayAssinanteCpf({ cpfNaoInformado: true })).toBe('não informado');
    expect(displayAssinanteEmail({ emailNaoInformado: true })).toBe('não informado');
    expect(displayAssinanteCpf({ cpf: '21593803899' })).toBe('*.938.038-**');
  });
});
