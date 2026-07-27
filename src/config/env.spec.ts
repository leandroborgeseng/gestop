import { afterEach, describe, expect, it } from 'vitest';
import { assertProductionEnv, resolveJwtSecret, resolveStoragePublicUrlBase } from './env';

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
});

describe('resolveJwtSecret', () => {
  it('usa fallback em desenvolvimento', () => {
    delete process.env.NODE_ENV;
    delete process.env.JWT_SECRET;
    expect(resolveJwtSecret()).toBe('gestop-dev-secret-change-me');
  });

  it('exige segredo forte em producao', () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'curto';
    expect(() => resolveJwtSecret()).toThrow(/JWT_SECRET/);
  });

  it('rejeita placeholder do compose antigo', () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'change_me_jwt_secret';
    expect(() => resolveJwtSecret()).toThrow(/JWT_SECRET/);
  });

  it('aceita segredo forte em producao', () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'x'.repeat(40);
    expect(resolveJwtSecret()).toHaveLength(40);
  });
});

describe('assertProductionEnv', () => {
  it('exige STORAGE_PUBLIC_URL_BASE com driver local em producao', () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'x'.repeat(40);
    process.env.STORAGE_DRIVER = 'local';
    delete process.env.STORAGE_PUBLIC_URL_BASE;
    delete process.env.FRONTEND_PUBLIC_URL;
    delete process.env.APP_PUBLIC_URL;
    delete process.env.SERVICE_URL_WEB;
    delete process.env.CORS_ORIGINS;
    delete process.env.COOLIFY;
    delete process.env.COOLIFY_RESOURCE_UUID;
    delete process.env.RAILWAY_ENVIRONMENT;
    delete process.env.RAILWAY_PROJECT_ID;
    expect(() => assertProductionEnv()).toThrow(/STORAGE_PUBLIC_URL_BASE/);
  });

  it('no Coolify preenche STORAGE_PUBLIC_URL_BASE a partir de FRONTEND_PUBLIC_URL', () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'x'.repeat(40);
    process.env.STORAGE_DRIVER = 'local';
    process.env.STORAGE_LOCAL_DIR = '/data/gestop-evidencias';
    process.env.COOLIFY = 'true';
    delete process.env.STORAGE_PUBLIC_URL_BASE;
    process.env.FRONTEND_PUBLIC_URL = 'https://sigma.example.gov.br';
    expect(() => assertProductionEnv()).not.toThrow();
    expect(process.env.STORAGE_PUBLIC_URL_BASE).toBe('https://sigma.example.gov.br/api-gestop');
  });

  it('no Coolify sem URL publica usa fallback temporario', () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'x'.repeat(40);
    process.env.STORAGE_DRIVER = 'local';
    process.env.STORAGE_LOCAL_DIR = '/data/gestop-evidencias';
    process.env.COOLIFY = 'true';
    delete process.env.STORAGE_PUBLIC_URL_BASE;
    delete process.env.FRONTEND_PUBLIC_URL;
    delete process.env.APP_PUBLIC_URL;
    delete process.env.SERVICE_URL_WEB;
    delete process.env.CORS_ORIGINS;
    expect(() => assertProductionEnv()).not.toThrow();
    expect(process.env.STORAGE_PUBLIC_URL_BASE).toContain('/api-gestop');
  });

  it('exige variaveis S3 apenas quando STORAGE_DRIVER=s3', () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'x'.repeat(40);
    process.env.STORAGE_DRIVER = 's3';
    delete process.env.S3_BUCKET;
    expect(() => assertProductionEnv()).toThrow(/S3_BUCKET/);
  });
});

describe('resolveStoragePublicUrlBase', () => {
  it('retorna explicito quando definido', () => {
    process.env.STORAGE_PUBLIC_URL_BASE = 'https://x.example/api-gestop';
    expect(resolveStoragePublicUrlBase()).toBe('https://x.example/api-gestop');
  });
});
