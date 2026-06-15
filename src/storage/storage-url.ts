const STORAGE_PATH_MARKER = '/storage/';

export function extractStorageKeyFromUrl(url: string | null | undefined): string | null {
  if (!url?.trim()) return null;

  const trimmed = url.trim();
  const markerIndex = trimmed.indexOf(STORAGE_PATH_MARKER);
  if (markerIndex >= 0) {
    return trimmed.slice(markerIndex + STORAGE_PATH_MARKER.length).replace(/^\/+/, '');
  }

  if (trimmed.startsWith('evidencias/')) {
    return trimmed.replace(/^\/+/, '');
  }

  try {
    const parsed = new URL(trimmed);
    const pathMarker = parsed.pathname.indexOf(STORAGE_PATH_MARKER);
    if (pathMarker >= 0) {
      return parsed.pathname.slice(pathMarker + STORAGE_PATH_MARKER.length).replace(/^\/+/, '');
    }
  } catch {
    // URL relativa ou inválida — ignorar
  }

  return null;
}

export function buildStoragePublicUrl(storageKey: string | null | undefined): string | null {
  if (!storageKey?.trim()) return null;

  const key = storageKey.trim().replace(/^\/+/, '');
  const publicBase = process.env.STORAGE_PUBLIC_URL_BASE?.trim();
  if (publicBase) {
    return `${publicBase.replace(/\/$/, '')}/storage/${key}`;
  }

  return `/storage/${key}`;
}

export function resolveStoragePublicUrl(
  storageKey: string | null | undefined,
  legacyUrl: string | null | undefined,
): string | null {
  return buildStoragePublicUrl(storageKey) ?? legacyUrl ?? null;
}

export function normalizeStorageRoutePath(path: string | string[] | undefined): string | null {
  if (path == null) return null;

  const normalized = (Array.isArray(path) ? path.join('/') : String(path)).trim().replace(/^\/+/, '');
  if (!normalized || normalized.includes('..')) return null;
  return normalized;
}
