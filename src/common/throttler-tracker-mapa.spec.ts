import { afterEach, describe, expect, it } from 'vitest';
import { signJwt } from '../auth/jwt';
import { resolveJwtSecret } from '../config/env';
import {
  definirSecretJwtDoTracker,
  subDoAuthorization,
  trackerThrottlerMapaCamadas,
} from './throttler-tracker-mapa';

const USER_A = '11111111-1111-4111-8111-111111111111';
const USER_B = '22222222-2222-4222-8222-222222222222';
const PROXY_IP = '10.0.0.5';
const SECRET = resolveJwtSecret();

function bearer(sub: string, secret = SECRET, expiresInSeconds?: number) {
  return `Bearer ${signJwt({ sub, email: 't@aion.local', nome: 't', perfis: [], permissoes: [] }, secret, expiresInSeconds)}`;
}

function bearerForjado(sub: string) {
  const payload = Buffer.from(JSON.stringify({ sub, exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url');
  return `Bearer x.${payload}.assinatura-falsa`;
}

afterEach(() => definirSecretJwtDoTracker(null));

describe('trackerThrottlerMapaCamadas · não compartilha o IP do proxy', () => {
  it('dois usuários atrás do mesmo IP do proxy têm buckets diferentes (sub do JWT verificado)', () => {
    const req = (sub: string) => ({ headers: { authorization: bearer(sub) }, ip: PROXY_IP, ips: [] });
    const a = trackerThrottlerMapaCamadas(req(USER_A));
    const b = trackerThrottlerMapaCamadas(req(USER_B));
    expect(a).toBe(`sub:${USER_A}`);
    expect(b).toBe(`sub:${USER_B}`);
    expect(a).not.toBe(b);
    expect(a).not.toBe(PROXY_IP);
  });

  it('sem JWT, JWT inválido ou sub que não é uuid: cai no IP (igual ao ThrottlerGuard)', () => {
    expect(trackerThrottlerMapaCamadas({ headers: {}, ip: PROXY_IP })).toBe(PROXY_IP);
    expect(trackerThrottlerMapaCamadas({ headers: { authorization: 'Bearer not-a-jwt' }, ip: PROXY_IP })).toBe(PROXY_IP);
    expect(trackerThrottlerMapaCamadas({ headers: { authorization: bearer('nao-uuid') }, ip: PROXY_IP })).toBe(PROXY_IP);
    expect(trackerThrottlerMapaCamadas({ ips: [PROXY_IP] })).toBe(PROXY_IP);
    expect(trackerThrottlerMapaCamadas({})).toBe('anonymous');
  });

  it('assinatura inválida (token forjado com sub uuid): cai no IP, não abre cota nova', () => {
    expect(subDoAuthorization(bearerForjado(USER_A))).toBeNull();
    expect(trackerThrottlerMapaCamadas({ headers: { authorization: bearerForjado(USER_A) }, ip: PROXY_IP })).toBe(PROXY_IP);
    expect(trackerThrottlerMapaCamadas({ headers: { authorization: bearer(USER_A, 'outro-segredo-que-nao-e-o-da-api') }, ip: PROXY_IP })).toBe(PROXY_IP);
  });

  it('token expirado: cai no IP', () => {
    const expirado = bearer(USER_A, SECRET, -60);
    expect(subDoAuthorization(expirado)).toBeNull();
    expect(trackerThrottlerMapaCamadas({ headers: { authorization: expirado }, ip: PROXY_IP })).toBe(PROXY_IP);
  });

  it('lê Authorization em qualquer caixa e ignora payload malformado', () => {
    expect(subDoAuthorization(bearer(USER_A))).toBe(USER_A);
    expect(trackerThrottlerMapaCamadas({ headers: { Authorization: bearer(USER_A) }, ip: PROXY_IP })).toBe(`sub:${USER_A}`);
    expect(subDoAuthorization('Bearer aaa.!!!notb64!!!.bbb')).toBeNull();
    expect(subDoAuthorization(undefined as unknown as string)).toBeNull();
  });

  it('usa o segredo do ConfigService quando o controller registra o resolver (sonda HTTP)', () => {
    const secretSonda = 'qa64-segredo-sintetico-de-teste-com-32+chars';
    definirSecretJwtDoTracker(() => secretSonda);
    const token = bearer(USER_A, secretSonda);
    expect(trackerThrottlerMapaCamadas({ headers: { authorization: token }, ip: PROXY_IP })).toBe(`sub:${USER_A}`);
    expect(trackerThrottlerMapaCamadas({ headers: { authorization: bearer(USER_A, SECRET) }, ip: PROXY_IP })).toBe(PROXY_IP);
  });
});
