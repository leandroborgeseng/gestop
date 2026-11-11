import { afterEach, describe, expect, it, vi } from 'vitest';
import { AUTH_REMEMBER_STORAGE_KEY } from './api';
import { deveRenovarToken, LIMIAR_RENOVACAO_MS, revalidarSessaoNaRetomada, tokenPertoDeExpirar } from './sessao-renovacao';

const AGORA = 1_700_000_000_000;

function instalarJanela(auth: unknown, remember: '0' | '1') {
  const store = new Map<string, string>([
    ['sigma.auth', JSON.stringify(auth)],
    [AUTH_REMEMBER_STORAGE_KEY, remember],
  ]);
  const location = { pathname: '/execucao', search: '?aba=tarefas', href: '/execucao?aba=tarefas' };
  vi.stubGlobal('window', {
    localStorage: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
    },
    location,
  });
  return { store, location };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('token perto de expirar', () => {
  it('só a sessão de 30 dias dentro do limiar pede renovação', () => {
    expect(tokenPertoDeExpirar(AGORA + LIMIAR_RENOVACAO_MS, AGORA)).toBe(true);
    expect(tokenPertoDeExpirar(AGORA + 20_000, AGORA)).toBe(true);
    expect(tokenPertoDeExpirar(AGORA + LIMIAR_RENOVACAO_MS + 1, AGORA)).toBe(false);
    expect(tokenPertoDeExpirar(AGORA, AGORA)).toBe(false);
    expect(deveRenovarToken(true, AGORA + 20_000, AGORA)).toBe(true);
    expect(deveRenovarToken(false, AGORA + 20_000, AGORA)).toBe(false);
  });
});

describe('revalidarSessaoNaRetomada', () => {
  it('renova o token perto de vencer e não mexe na URL', async () => {
    const { store, location } = instalarJanela(
      { accessToken: 'velho', user: { id: 'u', permissoes: ['matriz.cco._tela.visualizar'], perfis: [] }, expiresAt: Date.now() + 20_000 },
      '1',
    );
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            accessToken: 'novo-token',
            tokenType: 'Bearer',
            expiresInSeconds: 30 * 24 * 3600,
            user: { id: 'u', permissoes: ['matriz.cco._tela.visualizar'], perfis: [] },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      ),
    );

    const resultado = await revalidarSessaoNaRetomada();

    expect(resultado).toEqual({ acao: 'refresh', redirecionou: false });
    expect(location.href).toBe('/execucao?aba=tarefas');
    const gravado = JSON.parse(store.get('sigma.auth') ?? '{}') as { accessToken: string; expiresAt: number };
    expect(gravado.accessToken).toBe('novo-token');
    expect(gravado.expiresAt).toBeGreaterThan(Date.now() + 24 * 3600 * 1000);
    expect(vi.mocked(fetch).mock.calls[0]?.[0]).toBe('/api-gestop/auth/refresh');
  });

  it('401 no refresh mantém o token e a URL', async () => {
    const { store, location } = instalarJanela(
      { accessToken: 'velho', user: { id: 'u', permissoes: [], perfis: [] }, expiresAt: Date.now() + 20_000 },
      '1',
    );
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ message: 'nao' }), { status: 401 })));

    const resultado = await revalidarSessaoNaRetomada();

    expect(resultado).toEqual({ acao: 'refresh-falhou', redirecionou: false });
    expect(location.href).toBe('/execucao?aba=tarefas');
    expect(JSON.parse(store.get('sigma.auth') ?? '{}').accessToken).toBe('velho');
  });

  it('sessão folgada só revalida /auth/me e não chama o refresh', async () => {
    instalarJanela(
      { accessToken: 'ok', user: { id: 'u', permissoes: [], perfis: [] }, expiresAt: Date.now() + 10 * 24 * 3600 * 1000 },
      '1',
    );
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ id: 'u', permissoes: [], perfis: [] }), { status: 200 })),
    );

    const resultado = await revalidarSessaoNaRetomada();

    expect(resultado).toEqual({ acao: 'revalidar', redirecionou: false });
    expect(vi.mocked(fetch).mock.calls[0]?.[0]).toBe('/api-gestop/auth/me');
  });
});
