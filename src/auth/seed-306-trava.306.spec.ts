import { afterEach, describe, expect, it } from 'vitest';
import { assertBancoLocal306 } from '../../scripts/seed-escopo-306-core';

describe('306 — trava do seed (script e teste de banco)', () => {
  const envOriginal = process.env.NODE_ENV;
  afterEach(() => {
    process.env.NODE_ENV = envOriginal;
  });
  it('aceita só banco local', () => {
    expect(() => assertBancoLocal306('postgresql://u@localhost:5432/t')).not.toThrow();
    expect(() => assertBancoLocal306('postgresql://u@127.0.0.1/t')).not.toThrow();
    expect(() => assertBancoLocal306('postgresql://u@x/t?host=/tmp')).not.toThrow();
    expect(() => assertBancoLocal306('postgresql://u@db.exemplo.invalid:5432/t')).toThrow();
    expect(() => assertBancoLocal306(undefined)).toThrow();
  });
  it('recusa NODE_ENV=production mesmo em localhost', () => {
    process.env.NODE_ENV = 'production';
    expect(() => assertBancoLocal306('postgresql://u@localhost:5432/t')).toThrow();
  });
});
