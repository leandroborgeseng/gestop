'use client';

import { FileText } from 'lucide-react';
import { baixarStorageAutenticado } from '@/lib/storage-url';

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
    event.stopPropagation();
    await baixarStorageAutenticado(href, label);
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
