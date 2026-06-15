import { API_PROXY_PREFIX } from '@/lib/api';

export function resolveStorageApiPath(url: string) {
  const marker = '/storage/';
  const index = url.indexOf(marker);
  if (index >= 0) {
    const key = url.slice(index + marker.length).replace(/^\/+/, '');
    return `${API_PROXY_PREFIX}/storage/${key}`;
  }
  if (url.startsWith('storage/')) {
    return `${API_PROXY_PREFIX}/${url}`;
  }
  if (url.startsWith('evidencias/')) {
    return `${API_PROXY_PREFIX}/storage/${url}`;
  }
  return null;
}

export async function fetchAuthenticatedStorageBlob(url: string) {
  const apiPath = resolveStorageApiPath(url);
  if (!apiPath) return null;

  const { getStoredAuth } = await import('@/lib/api');
  const auth = getStoredAuth();
  if (!auth?.accessToken) return null;

  const response = await fetch(apiPath, {
    headers: { Authorization: `Bearer ${auth.accessToken}` },
  });
  if (!response.ok) return null;
  return response.blob();
}
