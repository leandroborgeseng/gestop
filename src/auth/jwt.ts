import { createHmac, timingSafeEqual } from 'node:crypto';

export type JwtPayload = {
  sub: string;
  email: string;
  nome: string;
  perfis: string[];
  permissoes: string[];
  iat?: number;
  exp?: number;
};

const DEFAULT_EXPIRES_IN_SECONDS = 60 * 60 * 8;

function base64UrlEncode(input: Buffer | string) {
  return Buffer.from(input).toString('base64url');
}

function base64UrlDecode<T>(input: string): T {
  return JSON.parse(Buffer.from(input, 'base64url').toString('utf8')) as T;
}

function signPart(value: string, secret: string) {
  return createHmac('sha256', secret).update(value).digest('base64url');
}

export function signJwt(
  payload: Omit<JwtPayload, 'iat' | 'exp'>,
  secret: string,
  expiresInSeconds = DEFAULT_EXPIRES_IN_SECONDS,
) {
  const now = Math.floor(Date.now() / 1000);
  const header = {
    alg: 'HS256',
    typ: 'JWT',
  };
  const body: JwtPayload = {
    ...payload,
    iat: now,
    exp: now + expiresInSeconds,
  };

  const unsigned = `${base64UrlEncode(JSON.stringify(header))}.${base64UrlEncode(JSON.stringify(body))}`;
  return `${unsigned}.${signPart(unsigned, secret)}`;
}

export function verifyJwt(token: string, secret: string): JwtPayload {
  const [encodedHeader, encodedPayload, signature] = token.split('.');

  if (!encodedHeader || !encodedPayload || !signature) {
    throw new Error('Token invalido');
  }

  const unsigned = `${encodedHeader}.${encodedPayload}`;
  const expectedSignature = signPart(unsigned, secret);
  const expected = Buffer.from(expectedSignature);
  const received = Buffer.from(signature);

  if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
    throw new Error('Assinatura invalida');
  }

  const payload = base64UrlDecode<JwtPayload>(encodedPayload);
  const now = Math.floor(Date.now() / 1000);

  if (payload.exp && payload.exp < now) {
    throw new Error('Token expirado');
  }

  return payload;
}
