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

function nomeArquivoSeguro(nome: string) {
  const limpo = nome.replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim();
  return limpo || 'documento.pdf';
}

/** Um único download, com o nome do arquivo. Não abre a URL técnica do storage. */
export function baixarBlobUmaVez(blob: Blob, nome: string) {
  const filename = nomeArquivoSeguro(nome);
  const file = new File([blob], filename, { type: blob.type || 'application/pdf' });
  const objectUrl = URL.createObjectURL(file);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}

export async function baixarStorageAutenticado(url: string, nome: string) {
  const blob = await fetchAuthenticatedStorageBlob(url);
  if (!blob) return false;
  const filename = nome.toLowerCase().endsWith('.pdf') || !blob.type.includes('pdf') ? nome : `${nome}.pdf`;
  baixarBlobUmaVez(blob, filename);
  return true;
}
