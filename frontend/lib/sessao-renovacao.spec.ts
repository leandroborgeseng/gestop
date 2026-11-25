import { afterEach, describe, expect, it, vi } from 'vitest';
import { AUTH_REMEMBER_STORAGE_KEY } from './api';
import { agendarRevalidacaoNaRetomada, deveRenovarToken, ESPERA_RETORNO_MS, LIMIAR_RENOVACAO_MS, prepararSessaoAoAbrir, revalidarSessaoNaRetomada, tokenPertoDeExpirar } from './sessao-renovacao';

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
    dispatchEvent: vi.fn(),
  });
  return { store, location };
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('token perto de expirar', () => {
  const dia = 24 * 60 * 60 * 1000;

  it('renova a sessão de 30 dias quando faltam menos de 7 dias', () => {
    expect(LIMIAR_RENOVACAO_MS).toBe(7 * dia);
    expect(tokenPertoDeExpirar(AGORA + LIMIAR_RENOVACAO_MS, AGORA)).toBe(true);
    expect(tokenPertoDeExpirar(AGORA + 6 * dia, AGORA)).toBe(true);
    expect(tokenPertoDeExpirar(AGORA + LIMIAR_RENOVACAO_MS + 1, AGORA)).toBe(false);
    expect(tokenPertoDeExpirar(AGORA + 8 * dia, AGORA)).toBe(false);
    expect(tokenPertoDeExpirar(AGORA, AGORA)).toBe(false);
    expect(deveRenovarToken(true, AGORA + 6 * dia, AGORA)).toBe(true);
    expect(deveRenovarToken(true, AGORA + 8 * dia, AGORA)).toBe(false);
    expect(deveRenovarToken(false, AGORA + 6 * dia, AGORA)).toBe(false);
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

  it('revalidação em andamento não engole o refresh de um token que envelheceu', async () => {
    const { store } = instalarJanela(
      { accessToken: 'ok', user: { id: 'u', permissoes: [], perfis: [] }, expiresAt: Date.now() + 10 * 24 * 3600 * 1000 },
      '1',
    );
    let liberar: () => void = () => undefined;
    const porta = new Promise<void>((resolve) => {
      liberar = resolve;
    });
    const urls: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string) => {
        urls.push(String(input));
        if (urls.length === 1) await porta;
        if (String(input).includes('/auth/refresh')) {
          return new Response(
            JSON.stringify({ accessToken: 'novo', tokenType: 'Bearer', expiresInSeconds: 30 * 24 * 3600, user: { id: 'u', permissoes: [], perfis: [] } }),
            { status: 200 },
          );
        }
        return new Response(JSON.stringify({ id: 'u', permissoes: [], perfis: [] }), { status: 200 });
      }),
    );

    const primeira = revalidarSessaoNaRetomada();
    await vi.waitFor(() => expect(urls).toEqual(['/api-gestop/auth/me']));
    const auth = JSON.parse(store.get('sigma.auth') ?? '{}') as { expiresAt: number };
    auth.expiresAt = Date.now() + 20_000;
    store.set('sigma.auth', JSON.stringify(auth));
    const segunda = revalidarSessaoNaRetomada();
    liberar();
    const [a, b] = await Promise.all([primeira, segunda]);

    expect(a.redirecionou).toBe(false);
    expect(b).toEqual({ acao: 'refresh', redirecionou: false });
    expect(urls).toContain('/api-gestop/auth/refresh');
    expect(JSON.parse(store.get('sigma.auth') ?? '{}').accessToken).toBe('novo');
  });

  it('na abertura, renova se faltam 6 dias e não chama a rede se faltam 8', async () => {
    const dia = 24 * 60 * 60 * 1000;
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          accessToken: 'renovado-na-abertura',
          tokenType: 'Bearer',
          expiresInSeconds: 6 * 24 * 3600,
          user: { id: 'u', permissoes: [], perfis: [] },
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    instalarJanela(
      { accessToken: 'velho', user: { id: 'u', permissoes: [], perfis: [] }, expiresAt: Date.now() + 6 * dia },
      '1',
    );
    const perto = await prepararSessaoAoAbrir();
    expect(perto).toEqual({ acao: 'refresh', redirecionou: false });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe('/api-gestop/auth/refresh');

    fetchMock.mockClear();
    instalarJanela(
      { accessToken: 'folgado', user: { id: 'u', permissoes: [], perfis: [] }, expiresAt: Date.now() + 8 * dia },
      '1',
    );
    const folgado = await prepararSessaoAoAbrir();
    expect(folgado).toEqual({ acao: 'ignorada', redirecionou: false });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('token já vencido avisa a expiração e não chama a rede', async () => {
    const { store, location } = instalarJanela(
      { accessToken: 'velho', user: { id: 'u', permissoes: [], perfis: [] }, expiresAt: Date.now() - 1_000 },
      '1',
    );
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 200 })));

    const resultado = await revalidarSessaoNaRetomada();

    expect(resultado).toEqual({ acao: 'expirada', redirecionou: true });
    expect(location.href).toBe('/execucao?aba=tarefas');
    expect(store.has('sigma.auth')).toBe(false);
    expect(vi.mocked(window.dispatchEvent)).toHaveBeenCalled();
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
  });

  it('três eventos da mesma retomada disparam um único refresh', async () => {
    instalarJanela(
      { accessToken: 'velho', user: { id: 'u', permissoes: [], perfis: [] }, expiresAt: Date.now() + 20_000 },
      '1',
    );
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({ accessToken: 'um-so', tokenType: 'Bearer', expiresInSeconds: 30 * 24 * 3600, user: { id: 'u', permissoes: [], perfis: [] } }),
        { status: 200 },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);
    vi.useFakeTimers();

    const primeira = agendarRevalidacaoNaRetomada();
    const segunda = agendarRevalidacaoNaRetomada();
    const terceira = agendarRevalidacaoNaRetomada();
    expect(primeira).toBe(segunda);
    expect(segunda).toBe(terceira);
    expect(fetchMock).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(ESPERA_RETORNO_MS);
    await Promise.all([primeira, segunda, terceira]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe('/api-gestop/auth/refresh');
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
