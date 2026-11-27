import { describe, expect, it } from 'vitest';
import { subDoAuthorization, trackerThrottlerMapaCamadas } from './throttler-tracker-mapa';

const USER_A = '11111111-1111-4111-8111-111111111111';
const USER_B = '22222222-2222-4222-8222-222222222222';
const PROXY_IP = '10.0.0.5';

function bearer(sub: string, extra = {}) {
  const payload = Buffer.from(JSON.stringify({ sub, ...extra })).toString('base64url');
  return `Bearer header.${payload}.sig`;
}

describe('trackerThrottlerMapaCamadas · não compartilha o IP do proxy', () => {
  it('dois usuários atrás do mesmo IP do proxy têm buckets diferentes (sub do JWT)', () => {
    const req = (sub: string) => ({ headers: { authorization: bearer(sub) }, ip: PROXY_IP, ips: [] });
    const a = trackerThrottlerMapaCamadas(req(USER_A));
    const b = trackerThrottlerMapaCamadas(req(USER_B));
    expect(a).toBe(`sub:${USER_A}`);
    expect(b).toBe(`sub:${USER_B}`);
    expect(a).not.toBe(b);
    // O tracker padrão (só IP) colidiria e somaria as 120 req/min de todos no mesmo bucket.
    expect(a).not.toBe(PROXY_IP);
  });

  it('sem JWT, JWT inválido ou sub que não é uuid: cai no IP (igual ao ThrottlerGuard)', () => {
    expect(trackerThrottlerMapaCamadas({ headers: {}, ip: PROXY_IP })).toBe(PROXY_IP);
    expect(trackerThrottlerMapaCamadas({ headers: { authorization: 'Bearer not-a-jwt' }, ip: PROXY_IP })).toBe(PROXY_IP);
    expect(trackerThrottlerMapaCamadas({ headers: { authorization: bearer('nao-uuid') }, ip: PROXY_IP })).toBe(PROXY_IP);
    expect(trackerThrottlerMapaCamadas({ ips: [PROXY_IP] })).toBe(PROXY_IP);
    expect(trackerThrottlerMapaCamadas({})).toBe('anonymous');
  });

  it('lê Authorization em qualquer caixa e ignora payload malformado', () => {
    expect(subDoAuthorization(bearer(USER_A))).toBe(USER_A);
    expect(trackerThrottlerMapaCamadas({ headers: { Authorization: bearer(USER_A) }, ip: PROXY_IP })).toBe(`sub:${USER_A}`);
    expect(subDoAuthorization('Bearer aaa.!!!notb64!!!.bbb')).toBeNull();
    expect(subDoAuthorization(undefined as unknown as string)).toBeNull();
  });
});
