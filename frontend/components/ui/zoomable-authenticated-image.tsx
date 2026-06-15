'use client';

import { useEffect, useState } from 'react';
import { X, ZoomIn } from 'lucide-react';
import { cn } from '@/lib/cn';
import { AuthenticatedImage } from '@/components/ui/authenticated-image';

export function ZoomableAuthenticatedImage({
  src,
  alt,
  className,
  previewClassName,
}: {
  src: string;
  alt: string;
  className?: string;
  previewClassName?: string;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          'group relative block w-full overflow-hidden rounded-[var(--r-md)] border border-[var(--line)] text-left',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]',
        )}
        aria-label={`Ampliar ${alt}`}
      >
        <AuthenticatedImage src={src} alt={alt} className={className} />
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/0 transition group-hover:bg-black/25">
          <span className="inline-flex items-center gap-1 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-semibold text-white opacity-0 transition group-hover:opacity-100">
            <ZoomIn className="h-3.5 w-3.5" />
            Ampliar
          </span>
        </span>
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/85 p-4 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
          aria-label={alt}
          onClick={() => setOpen(false)}
        >
          <button
            type="button"
            className="absolute top-4 right-4 inline-flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70"
            aria-label="Fechar visualização"
            onClick={() => setOpen(false)}
          >
            <X className="h-5 w-5" />
          </button>
          <div
            className="max-h-[92vh] max-w-[min(96vw,1100px)] overflow-auto"
            onClick={(event) => event.stopPropagation()}
          >
            <AuthenticatedImage
              src={src}
              alt={alt}
              className={cn('max-h-[92vh] w-full object-contain', previewClassName)}
            />
          </div>
        </div>
      ) : null}
    </>
  );
}
