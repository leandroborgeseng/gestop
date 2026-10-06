import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  buildLivenessHealth,
  HEALTH_LIVENESS_KEYS,
  HEALTH_OBSERVABILITY_KEYS,
  HealthController,
} from './health.controller';

const originalEnv = { ...process.env };
const VALID_SHA = '377c3e48f756aa2d7a5dbe05088b0134cefc47ee';

afterEach(() => {
  process.env = { ...originalEnv };
});

describe('HealthController.getHealth', () => {
  const controller = new HealthController({} as never);

  it('mantem status HTTP 200 implicito e os campos antigos', () => {
    const source = readFileSync(join(__dirname, 'health.controller.ts'), 'utf8');
    expect(source).not.toMatch(/@HttpCode\s*\(/);
    expect(source).toMatch(/@Get\(\)\s*\n\s*getHealth\(\)/);

    const body = controller.getHealth();
    expect(body.status).toBe('ok');
    expect(typeof body.status).toBe('string');
    expect(body.service).toBe('sigma-api');
    expect(typeof body.service).toBe('string');
    expect(typeof body.version).toBe('string');
    expect(typeof body.uptimeSeconds).toBe('number');
    expect(body.uptimeSeconds).toBeGreaterThanOrEqual(0);
    expect(typeof body.timestamp).toBe('string');
    expect(Number.isNaN(Date.parse(body.timestamp))).toBe(false);
    expect(typeof body.observability).toBe('object');
    expect(body.observability).not.toBeNull();
    expect(typeof body.observability.sentryConfigured).toBe('boolean');
    expect(typeof body.observability.webhookConfigured).toBe('boolean');
    expect(typeof body.observability.emailConfigured).toBe('boolean');
    expect(typeof body.observability.webPushConfigured).toBe('boolean');
    expect(typeof body.observability.webmapCronConfigured).toBe('boolean');
  });

  it('o conjunto de chaves e exatamente o antigo mais commit e commitShort', () => {
    const body = controller.getHealth();
    expect(Object.keys(body).sort()).toEqual([...HEALTH_LIVENESS_KEYS].sort());
    expect(Object.keys(body.observability).sort()).toEqual([...HEALTH_OBSERVABILITY_KEYS].sort());
  });

  it('nao expoe outros valores de ambiente', () => {
    process.env.DATABASE_URL = 'postgresql://secret-user:secret-pass@db/gestop';
    process.env.JWT_SECRET = 'jwt-secret-value-must-not-leak-123456';
    process.env.INITIAL_ADMIN_PASSWORD = 'admin-password-must-not-leak';
    const body = controller.getHealth();
    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain('postgresql://');
    expect(serialized).not.toContain('secret-pass');
    expect(serialized).not.toContain('jwt-secret-value-must-not-leak');
    expect(serialized).not.toContain('admin-password-must-not-leak');
    expect(serialized).not.toContain('DATABASE_URL');
    expect(serialized).not.toContain('JWT_SECRET');
    expect(Object.keys(body).sort()).toEqual([...HEALTH_LIVENESS_KEYS].sort());
  });

  it('commit e commitShort sao null ou o par derivado do SHA de 40 hex', () => {
    const body = controller.getHealth();
    if (body.commit === null) {
      expect(body.commitShort).toBeNull();
    } else {
      expect(body.commit).toMatch(/^[0-9a-f]{40}$/);
      expect(body.commitShort).toBe(body.commit.slice(0, 7));
    }
  });
});

describe('buildLivenessHealth', () => {
  it('propaga o SHA resolvido sem alterar os campos antigos', () => {
    const now = new Date('2026-10-06T01:00:00.000Z');
    const body = buildLivenessHealth(now, {
      commit: VALID_SHA,
      commitShort: VALID_SHA.slice(0, 7),
    });
    expect(body.status).toBe('ok');
    expect(body.service).toBe('sigma-api');
    expect(body.timestamp).toBe('2026-10-06T01:00:00.000Z');
    expect(body.commit).toBe(VALID_SHA);
    expect(body.commitShort).toBe('377c3e4');
    expect(Object.keys(body).sort()).toEqual([...HEALTH_LIVENESS_KEYS].sort());
  });

  it('com commit null os dois campos novos ficam null', () => {
    const body = buildLivenessHealth(new Date(), { commit: null, commitShort: null });
    expect(body.status).toBe('ok');
    expect(body.commit).toBeNull();
    expect(body.commitShort).toBeNull();
  });
});
