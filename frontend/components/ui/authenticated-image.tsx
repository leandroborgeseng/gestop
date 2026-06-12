'use client';

import { useEffect, useState } from 'react';
import { API_PROXY_PREFIX, getStoredAuth } from '@/lib/api';

function resolveStorageApiPath(url: string) {
  const marker = '/storage/';
  const index = url.indexOf(marker);
  if (index >= 0) {
    return `${API_PROXY_PREFIX}/storage/${url.slice(index + marker.length)}`;
  }
  if (url.startsWith('storage/')) {
    return `${API_PROXY_PREFIX}/${url}`;
  }
  return null;
}

export function AuthenticatedImage({
  src,
  alt,
  className,
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    let createdUrl: string | null = null;

    async function load() {
      const apiPath = resolveStorageApiPath(src);
      if (!apiPath) {
        if (active) setObjectUrl(src);
        return;
      }

      const auth = getStoredAuth();
      if (!auth?.accessToken) {
        if (active) setFailed(true);
        return;
      }

      try {
        const response = await fetch(apiPath, {
          headers: { Authorization: `Bearer ${auth.accessToken}` },
        });
        if (!response.ok) throw new Error('Falha ao carregar imagem');
        const blob = await response.blob();
        createdUrl = URL.createObjectURL(blob);
        if (active) setObjectUrl(createdUrl);
      } catch {
        if (active) setFailed(true);
      }
    }

    void load();

    return () => {
      active = false;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [src]);

  if (failed) {
    return (
      <div className={className} role="img" aria-label={alt}>
        <div className="flex h-full min-h-[120px] items-center justify-center bg-[var(--surface-2)] text-[12px] text-[var(--ink-3)]">
          Imagem indisponível
        </div>
      </div>
    );
  }

  if (!objectUrl) {
    return <div className={className} aria-hidden />;
  }

  return <img src={objectUrl} alt={alt} className={className} />;
}
