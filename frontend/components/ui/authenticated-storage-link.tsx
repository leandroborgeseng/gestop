'use client';

import { FileText } from 'lucide-react';
import { fetchAuthenticatedStorageBlob } from '@/lib/storage-url';

export function AuthenticatedStorageLink({
  href,
  label,
  className,
}: {
  href: string;
  label: string;
  className?: string;
}) {
  async function handleClick(event: React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    try {
      const blob = await fetchAuthenticatedStorageBlob(href);
      if (!blob) {
        window.open(href, '_blank', 'noopener,noreferrer');
        return;
      }
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = label;
      anchor.target = '_blank';
      anchor.rel = 'noreferrer';
      anchor.click();
      URL.revokeObjectURL(objectUrl);
    } catch {
      window.open(href, '_blank', 'noopener,noreferrer');
    }
  }

  return (
    <button
      type="button"
      onClick={(event) => void handleClick(event)}
      className={className ?? 'inline-flex items-center gap-1 text-[var(--brand)] hover:underline'}
    >
      <FileText className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}
