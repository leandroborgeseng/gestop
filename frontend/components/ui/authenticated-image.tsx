'use client';

import { useEffect, useState } from 'react';
import { fetchAuthenticatedStorageBlob, resolveStorageApiPath } from '@/lib/storage-url';

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
      if (!resolveStorageApiPath(src)) {
        if (active) setObjectUrl(src);
        return;
      }

      try {
        const blob = await fetchAuthenticatedStorageBlob(src);
        if (!blob) throw new Error('Falha ao carregar imagem');
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
