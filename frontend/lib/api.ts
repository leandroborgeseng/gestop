import {
  AuthUser,
  AdminPerfil,
  AdminSecretaria,
  AdminUnidade,
  AdminUsuario,
  ChecklistModel,
  ChecklistVersao,
  AuditoriaEvento,
  DashboardData,
  IntegracoesEventos,
  LoginResponse,
  MobileFieldPackage,
  MobileQueuedInspection,
  OperacionalResumo,
  OrdemServicoResumo,
  OrdemServicoDetalhe,
  SecretariaOption,
  UnidadeDetalhe,
  UnidadeFilters,
  UnidadeOperacional,
} from './types';

// Sempre usa proxy interno do Next.js no browser.
// NEXT_PUBLIC_API_URL apontando para URL externa quebra login no Railway.
const API_BASE_URL = '/api-gestop';
const AUTH_STORAGE_KEY = 'gestop.auth';

async function readApiError(response: Response, fallback: string) {
  try {
    const payload = (await response.json()) as { message?: string; error?: string };
    return payload.message ?? payload.error ?? fallback;
  } catch {
    return fallback;
  }
}

export type StoredAuth = {
  accessToken: string;
  user: AuthUser;
  expiresAt: number;
};

export function getStoredAuth(): StoredAuth | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as StoredAuth;

    if (parsed.expiresAt <= Date.now()) {
      clearStoredAuth();
      return null;
    }

    return parsed;
  } catch {
    clearStoredAuth();
    return null;
  }
}

export function setStoredAuth(auth: StoredAuth) {
  window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(auth));
}

export function clearStoredAuth() {
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getStoredAuth()?.accessToken;
  let response: Response;

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: {
        ...(init?.headers ?? {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      cache: 'no-store',
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'erro de rede';
    throw new Error(`Falha de conexao com a API (${API_BASE_URL}). ${detail}`);
  }

  if (response.status === 401) {
    clearStoredAuth();
    throw new Error('Sessão expirada. Faça login novamente.');
  }

  if (response.status === 403) {
    throw new Error('Acesso negado para o seu perfil.');
  }

  if (!response.ok) {
    throw new Error(await readApiError(response, `Falha ao consultar API (${response.status})`));
  }

  return response.json() as Promise<T>;
}

export async function login(email: string, password: string) {
  let response: Response;

  try {
    response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'erro de rede';
    throw new Error(`Falha de conexao com a API (${API_BASE_URL}). ${detail}`);
  }

  if (response.status === 401) {
    throw new Error('Credenciais inválidas.');
  }

  if (!response.ok) {
    throw new Error(await readApiError(response, `Falha ao autenticar (${response.status})`));
  }

  const data = (await response.json()) as LoginResponse;
  setStoredAuth({
    accessToken: data.accessToken,
    user: data.user,
    expiresAt: Date.now() + data.expiresInSeconds * 1000,
  });

  return data;
}

export function logout() {
  clearStoredAuth();
}

export function getMe() {
  return request<AuthUser>('/auth/me');
}

export function getResumoOperacional() {
  return request<OperacionalResumo>('/operacional/resumo');
}

export function getSecretarias() {
  return request<SecretariaOption[]>('/operacional/secretarias');
}

export function getBairros() {
  return request<string[]>('/operacional/bairros');
}

export function getUnidades(filters: UnidadeFilters) {
  const params = new URLSearchParams();

  Object.entries(filters).forEach(([key, value]) => {
    if (value) {
      params.set(key, value);
    }
  });

  const query = params.toString();
  return request<UnidadeOperacional[]>(`/operacional/unidades${query ? `?${query}` : ''}`);
}

export function getUnidadeDetalhe(id: string) {
  return request<UnidadeDetalhe>(`/operacional/unidades/${id}`);
}

export function listAdminSecretarias() {
  return request<AdminSecretaria[]>('/admin/secretarias');
}

export function saveAdminSecretaria(payload: Partial<AdminSecretaria>, id?: string) {
  return request<AdminSecretaria>(`/admin/secretarias${id ? `/${id}` : ''}`, {
    method: id ? 'PUT' : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export function deleteAdminSecretaria(id: string) {
  return request<AdminSecretaria>(`/admin/secretarias/${id}`, { method: 'DELETE' });
}

export function listAdminUnidades() {
  return request<AdminUnidade[]>('/admin/unidades');
}

export function saveAdminUnidade(payload: Record<string, unknown>, id?: string) {
  return request<AdminUnidade>(`/admin/unidades${id ? `/${id}` : ''}`, {
    method: id ? 'PUT' : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export function deleteAdminUnidade(id: string) {
  return request<AdminUnidade>(`/admin/unidades/${id}`, { method: 'DELETE' });
}

export function listAdminUsuarios() {
  return request<AdminUsuario[]>('/admin/usuarios');
}

export function saveAdminUsuario(payload: Record<string, unknown>, id?: string) {
  return request<AdminUsuario>(`/admin/usuarios${id ? `/${id}` : ''}`, {
    method: id ? 'PUT' : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export function deleteAdminUsuario(id: string) {
  return request<AdminUsuario>(`/admin/usuarios/${id}`, { method: 'DELETE' });
}

export function listAdminPerfis() {
  return request<AdminPerfil[]>('/admin/perfis');
}

export function listChecklists() {
  return request<ChecklistModel[]>('/checklists');
}

export function saveChecklist(payload: Record<string, unknown>, id?: string) {
  return request<ChecklistModel>(`/checklists${id ? `/${id}` : ''}`, {
    method: id ? 'PUT' : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export function deactivateChecklist(id: string) {
  return request<ChecklistModel>(`/checklists/${id}`, { method: 'DELETE' });
}

export function createChecklistVersion(id: string) {
  return request<ChecklistVersao>(`/checklists/${id}/versions`, { method: 'POST' });
}

export function updateChecklistVersion(versionId: string, payload: Record<string, unknown>) {
  return request<ChecklistVersao>(`/checklists/versions/${versionId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export function publishChecklistVersion(versionId: string) {
  return request<ChecklistVersao>(`/checklists/versions/${versionId}/publish`, { method: 'POST' });
}

export function getMobileFieldPackage() {
  return request<MobileFieldPackage>('/mobile/field-package');
}

export function syncMobileInspection(payload: MobileQueuedInspection) {
  return request<{ status: string; fiscalizacaoId?: string; syncEventId: string }>('/mobile/sync/fiscalizacoes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export function listOrdensServico() {
  return request<OrdemServicoResumo[]>('/ordens-servico');
}

export function getOrdemServico(id: string) {
  return request<OrdemServicoDetalhe>(`/ordens-servico/${id}`);
}

export function updateOrdemServico(id: string, payload: Record<string, unknown>) {
  return request<OrdemServicoResumo>(`/ordens-servico/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export function changePassword(currentPassword: string, newPassword: string) {
  return request<{ ok: boolean }>('/auth/change-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ currentPassword, newPassword }),
  });
}

export function getDashboard() {
  return request<DashboardData>('/monitoramento/dashboard');
}

export function listAuditoria() {
  return request<AuditoriaEvento[]>('/monitoramento/auditoria');
}

export function listIntegracoesEventos() {
  return request<IntegracoesEventos>('/integracoes/eventos');
}

export function retrySyncFalhas() {
  return request<{ reenfileirados: number }>('/integracoes/sync/retry', { method: 'POST' });
}

export function sendMockNotification(evento: string, payload: unknown) {
  return request<unknown>('/integracoes/notificar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ evento, payload }),
  });
}
