const cache = new Map<string, { expiresAt: number; content: string }>();

const DEFAULT_TTL_MS = 5 * 60 * 1000;

export function getCachedLayerContent(key: string) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.content;
}

export function setCachedLayerContent(key: string, content: string, ttlMs = DEFAULT_TTL_MS) {
  cache.set(key, { content, expiresAt: Date.now() + ttlMs });
}

export function buildLayerCacheKey(commitSha: string, file: string) {
  return `${commitSha}:${file}`;
}
