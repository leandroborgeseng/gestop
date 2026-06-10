import {
  AuthUser,
  AdminPerfil,
  AdminSecretaria,
  AdminUnidade,
  AdminUsuario,
  AdminEquipe,
  EquipeOpcao,
  ChecklistModel,
  ChecklistVersao,
  CronogramaChecagem,
  CalendarioChecagemResponse,
  AuditoriaEvento,
  DashboardData,
  AlertasOperacionais,
  IntegracoesEventos,
  LoginResponse,
  MobileFieldPackage,
  MobileQueuedInspection,
  OperacionalResumo,
  ChamadoResumo,
  ChamadoDetalhe,
  PublicUnidadeChamado,
  SecretariaOption,
  UnidadeDetalhe,
  UnidadeFilters,
  UnidadeFiltroOpcoes,
  UnidadeOperacional,
  WebmapImportResult,
  WebmapSyncAllResult,
  WebmapImportStatus,
} from './types';
import { notifyAuthExpired } from './security';

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

function handleUnauthorized() {
  clearStoredAuth();
  notifyAuthExpired();
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
    handleUnauthorized();
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

export function getOpcoesFiltroUnidades() {
  return request<UnidadeFiltroOpcoes>('/operacional/opcoes-filtro');
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

export function listAdminEquipes() {
  return request<AdminEquipe[]>('/admin/equipes');
}

export function saveAdminEquipe(payload: Record<string, unknown>, id?: string) {
  return request<AdminEquipe>(`/admin/equipes${id ? `/${id}` : ''}`, {
    method: id ? 'PUT' : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export function deleteAdminEquipe(id: string) {
  return request<AdminEquipe>(`/admin/equipes/${id}`, { method: 'DELETE' });
}

export function getWebmapImportStatus() {
  return request<WebmapImportStatus>('/admin/importacao/webmap/status');
}

export function syncWebmapImport(dryRun = false) {
  return request<WebmapImportResult>('/admin/importacao/webmap/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dryRun }),
  });
}

export function syncWebmapImportAll(dryRun = false) {
  return request<WebmapSyncAllResult>('/admin/importacao/webmap/sync-all', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dryRun }),
  });
}

export function syncSecretariasImport(dryRun = false) {
  return request<{ created: number; updated: number; total: number; dryRun: boolean }>(
    '/admin/importacao/secretarias/sync',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dryRun }),
    },
  );
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

export function listCronogramas(filters?: { secretariaId?: string; unidadeId?: string }) {
  const params = new URLSearchParams();
  if (filters?.secretariaId) params.set('secretariaId', filters.secretariaId);
  if (filters?.unidadeId) params.set('unidadeId', filters.unidadeId);
  const query = params.toString();
  return request<CronogramaChecagem[]>(`/cronograma${query ? `?${query}` : ''}`);
}

export function getCalendarioChecagens(filters: {
  from: string;
  to: string;
  secretariaId?: string;
  unidadeId?: string;
}) {
  const params = new URLSearchParams({ from: filters.from, to: filters.to });
  if (filters.secretariaId) params.set('secretariaId', filters.secretariaId);
  if (filters.unidadeId) params.set('unidadeId', filters.unidadeId);
  return request<CalendarioChecagemResponse>(`/cronograma/calendario?${params.toString()}`);
}

export function saveCronograma(payload: Record<string, unknown>, id?: string) {
  return request<CronogramaChecagem>(`/cronograma${id ? `/${id}` : ''}`, {
    method: id ? 'PUT' : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export function deactivateCronograma(id: string) {
  return request<CronogramaChecagem>(`/cronograma/${id}`, { method: 'DELETE' });
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

export function sendIntegrationNotification(evento: string, payload: unknown) {
  return request<{ adapter: string; delivered: boolean; evento: string }>('/integracoes/notificar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ evento, payload }),
  });
}

/** @deprecated */
export const sendMockNotification = sendIntegrationNotification;

export function requestPasswordReset(email: string) {
  return request<{ ok: boolean; message: string; devResetUrl?: string }>('/auth/forgot-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
}

export function resetPasswordWithToken(token: string, newPassword: string) {
  return request<{ ok: boolean }>('/auth/reset-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, newPassword }),
  });
}

export function anonymizeUsuarioLgpd(usuarioId: string) {
  return request<{ ok: boolean }>(`/lgpd/usuarios/${usuarioId}/anonymize`, { method: 'POST' });
}

export function purgeAuditoriaLgpd() {
  return request<{ removidos: number; retentionDays: number }>('/lgpd/auditoria/purge', { method: 'POST' });
}

async function publicRequest<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, init);
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'erro de rede';
    throw new Error(`Falha de conexao com a API (${API_BASE_URL}). ${detail}`);
  }

  if (!response.ok) {
    throw new Error(await readApiError(response, 'Falha na requisicao publica.'));
  }
  return response.json() as Promise<T>;
}

export function getPublicUnidade(codigoPatrimonial: string) {
  return publicRequest<PublicUnidadeChamado>(`/public/unidades/${encodeURIComponent(codigoPatrimonial)}`);
}

export function createPublicChamado(
  codigoPatrimonial: string,
  payload: {
    descricao: string;
    solicitanteNome?: string;
    solicitanteEmail?: string;
    solicitanteTelefone?: string;
    fotoDataUrl?: string;
  },
) {
  return publicRequest<ChamadoResumo>(`/public/unidades/${encodeURIComponent(codigoPatrimonial)}/chamados`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export function listChamados() {
  return request<ChamadoResumo[]>('/chamados');
}

export function createChamado(payload: {
  unidadeId: string;
  descricao: string;
  prioridade?: string;
  origem?: string;
  solicitanteNome?: string;
  solicitanteEmail?: string;
  solicitanteTelefone?: string;
}) {
  return request<ChamadoResumo>('/chamados', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export function getChamado(id: string) {
  return request<ChamadoDetalhe>(`/chamados/${id}`);
}

export function updateChamadoStatus(
  id: string,
  payload: { status: string; motivo?: string; impedimentoMotivo?: string; equipeId?: string },
) {
  return request<ChamadoResumo>(`/chamados/${id}/status`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export function listChamadoEquipes() {
  return request<EquipeOpcao[]>('/chamados/equipes/opcoes');
}

export function updateChamadoAtribuicao(
  id: string,
  payload: { equipeId?: string; responsavelId?: string; motivo?: string },
) {
  return request<ChamadoResumo>(`/chamados/${id}/atribuicao`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export function getAlertasOperacionais() {
  return request<AlertasOperacionais>('/monitoramento/alertas');
}

async function downloadRelatorio(
  formato: 'csv' | 'pdf',
  tipo: 'unidades' | 'chamados' | 'fiscalizacoes',
  params: Record<string, string> = {},
) {
  const token = getStoredAuth()?.accessToken;
  const query = new URLSearchParams(params);
  const suffix = query.toString() ? `?${query.toString()}` : '';

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/relatorios/export/${tipo}.${formato}${suffix}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'erro de rede';
    throw new Error(`Falha de conexao ao exportar relatorio. ${detail}`);
  }

  if (response.status === 401) {
    handleUnauthorized();
    throw new Error('Sessão expirada. Faça login novamente.');
  }

  if (response.status === 403) {
    throw new Error('Acesso negado para exportar este relatorio.');
  }

  if (!response.ok) {
    throw new Error(await readApiError(response, 'Falha ao exportar relatorio.'));
  }

  const blob = await response.blob();
  const filename =
    response.headers.get('content-disposition')?.match(/filename="(.+)"/)?.[1] ??
    `gestop-${tipo}.${formato}`;
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function downloadRelatorioCsv(
  tipo: 'unidades' | 'chamados' | 'fiscalizacoes',
  params: Record<string, string> = {},
) {
  return downloadRelatorio('csv', tipo, params);
}

export function downloadRelatorioPdf(
  tipo: 'unidades' | 'chamados' | 'fiscalizacoes',
  params: Record<string, string> = {},
) {
  return downloadRelatorio('pdf', tipo, params);
}

export function getVapidPublicKey() {
  return request<{ publicKey: string | null; enabled: boolean }>('/notificacoes/push/vapid-public-key');
}

export function subscribeWebPush(subscription: PushSubscriptionJSON) {
  return request<{ id: string }>('/notificacoes/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      endpoint: subscription.endpoint,
      keys: subscription.keys,
    }),
  });
}

export function unsubscribeWebPush(endpoint: string) {
  return request<{ ok: boolean }>('/notificacoes/push/unsubscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint }),
  });
}

export function dispararAlertasOperacionais() {
  return request<{ enviados: number; webhook: boolean; push: number }>('/notificacoes/alertas/disparar', {
    method: 'POST',
  });
}
