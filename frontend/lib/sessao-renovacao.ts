import { API_PROXY_PREFIX, AUTH_REMEMBER_STORAGE_KEY, getStoredAuth, setStoredAuth, type StoredAuth } from '@/lib/api';
import type { LoginResponse } from '@/lib/types';

/** Renova quando falta no máximo isto para o token de "manter conectado" vencer. */
export const LIMIAR_RENOVACAO_MS = 15 * 60 * 1000;

export type AcaoRetomada = 'ignorada' | 'revalidar' | 'refresh' | 'refresh-falhou' | 'revalidar-falhou';

export type RetomadaResultado = {
  acao: AcaoRetomada;
  /** A retomada nunca navega. O literal impede um retorno que diga o contrário. */
  redirecionou: false;
};

export function tokenPertoDeExpirar(expiresAt: number, agora = Date.now(), limiar = LIMIAR_RENOVACAO_MS) {
  return expiresAt > agora && expiresAt - agora <= limiar;
}

export function deveRenovarToken(manterConectado: boolean, expiresAt: number, agora = Date.now()) {
  return manterConectado && tokenPertoDeExpirar(expiresAt, agora);
}

function manterConectadoAtivo() {
  return window.localStorage.getItem(AUTH_REMEMBER_STORAGE_KEY) === '1';
}

function semRota(acao: AcaoRetomada): RetomadaResultado {
  return { acao, redirecionou: false };
}

async function lerJson(response: Response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

/**
 * POST /auth/refresh. Falha (rede ou 401) não apaga a sessão e não dispara o evento de expiração:
 * quem está na tela continua nela. O token só troca quando a resposta traz um access token novo.
 */
async function renovarToken(stored: StoredAuth): Promise<boolean> {
  let response: Response;
  try {
    response = await fetch(`${API_PROXY_PREFIX}/auth/refresh`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${stored.accessToken}` },
      cache: 'no-store',
    });
  } catch {
    return false;
  }
  if (!response.ok) return false;
  const data = (await lerJson(response)) as Partial<LoginResponse> | null;
  const expiresInSeconds = Number(data?.expiresInSeconds);
  if (!data?.accessToken || !Number.isFinite(expiresInSeconds) || expiresInSeconds <= 0) return false;
  const atual = getStoredAuth();
  if (!atual) return false;
  setStoredAuth({
    accessToken: data.accessToken,
    user: data.user ?? atual.user,
    expiresAt: Date.now() + expiresInSeconds * 1000,
  });
  return true;
}

/** GET /auth/me sem passar pelo cliente que, no 401, limpa a sessão e manda ao login. */
async function revalidarUsuario(stored: StoredAuth): Promise<boolean> {
  let response: Response;
  try {
    response = await fetch(`${API_PROXY_PREFIX}/auth/me`, {
      headers: { Authorization: `Bearer ${stored.accessToken}` },
      cache: 'no-store',
    });
  } catch {
    return false;
  }
  if (!response.ok) return false;
  const user = await lerJson(response);
  if (!user || typeof user !== 'object') return false;
  const atual = getStoredAuth();
  if (!atual) return false;
  setStoredAuth({ ...atual, user: user as StoredAuth['user'] });
  return true;
}

let emCurso: Promise<RetomadaResultado> | null = null;

async function executar(): Promise<RetomadaResultado> {
  if (typeof window === 'undefined') return semRota('ignorada');
  const stored = getStoredAuth();
  if (!stored) return semRota('ignorada');

  if (deveRenovarToken(manterConectadoAtivo(), stored.expiresAt)) {
    const renovou = await renovarToken(stored);
    return semRota(renovou ? 'refresh' : 'refresh-falhou');
  }

  const ok = await revalidarUsuario(stored);
  return semRota(ok ? 'revalidar' : 'revalidar-falhou');
}

/**
 * Retomada da aba ou do PWA (visibilitychange, focus, pageshow inclusive bfcache).
 * Revalida o usuário e, na sessão de 30 dias perto de vencer, renova o token.
 * Não lê nem escreve a rota.
 */
export function revalidarSessaoNaRetomada(): Promise<RetomadaResultado> {
  if (emCurso) return emCurso;
  emCurso = executar().finally(() => {
    emCurso = null;
  });
  return emCurso;
}
