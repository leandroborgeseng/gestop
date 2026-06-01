import { afterEach, describe, expect, it } from 'vitest';
import { assertProductionEnv, resolveJwtSecret } from './env';

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
    expect(() => assertProductionEnv()).toThrow(/STORAGE_PUBLIC_URL_BASE/);
  });

  it('exige variaveis S3 apenas quando STORAGE_DRIVER=s3', () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'x'.repeat(40);
    process.env.STORAGE_DRIVER = 's3';
    delete process.env.S3_BUCKET;
    expect(() => assertProductionEnv()).toThrow(/S3_BUCKET/);
  });
});
