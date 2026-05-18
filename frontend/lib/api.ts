import {
  AuthUser,
  AdminPerfil,
  AdminSecretaria,
  AdminUnidade,
  AdminUsuario,
  ChecklistModel,
  ChecklistVersao,
  LoginResponse,
  MobileFieldPackage,
  MobileQueuedInspection,
  OperacionalResumo,
  SecretariaOption,
  UnidadeDetalhe,
  UnidadeFilters,
  UnidadeOperacional,
} from './types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? '/api-gestop';
const AUTH_STORAGE_KEY = 'gestop.auth';

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
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    cache: 'no-store',
  });

  if (response.status === 401) {
    clearStoredAuth();
    throw new Error('Sessão expirada. Faça login novamente.');
  }

  if (response.status === 403) {
    throw new Error('Acesso negado para o seu perfil.');
  }

  if (!response.ok) {
    throw new Error(`Falha ao consultar API (${response.status})`);
  }

  return response.json() as Promise<T>;
}

export async function login(email: string, password: string) {
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  });

  if (response.status === 401) {
    throw new Error('Credenciais inválidas.');
  }

  if (!response.ok) {
    throw new Error(`Falha ao autenticar (${response.status})`);
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
