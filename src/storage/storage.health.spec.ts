import { afterEach, describe, expect, it } from 'vitest';
import { describeStoragePersistenceRisk } from './storage.health';

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
});

describe('describeStoragePersistenceRisk', () => {
  it('alerta quando STORAGE_LOCAL_DIR nao esta definido em producao', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.STORAGE_LOCAL_DIR;
    expect(describeStoragePersistenceRisk('/app/storage')).toMatch(/efemero/);
  });

  it('alerta quando aponta para /app em producao', () => {
    process.env.NODE_ENV = 'production';
    process.env.STORAGE_LOCAL_DIR = '/app/storage';
    expect(describeStoragePersistenceRisk('/app/storage')).toMatch(/Volume Railway/);
  });

  it('nao alerta para /data/gestop-evidencias', () => {
    process.env.NODE_ENV = 'production';
    process.env.STORAGE_LOCAL_DIR = '/data/gestop-evidencias';
    expect(describeStoragePersistenceRisk('/data/gestop-evidencias')).toBeNull();
  });
});
