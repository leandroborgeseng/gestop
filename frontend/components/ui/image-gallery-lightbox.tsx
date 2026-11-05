'use client';

/**
 * #311 CCO-V4 — lightbox de fotos com Anterior/Próxima e "Foto n de total".
 * Portal no host de overlay (fullscreen do mapa CCO). Esc fecha só o lightbox.
 */
import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { AuthenticatedImage } from '@/components/ui/authenticated-image';
import { cn } from '@/lib/cn';
import { useOverlayPortalHost } from '@/lib/overlay-portal-host';

export type GalleryFoto = { id: string; src: string; alt: string };

export function ImageGalleryLightbox({
  fotos,
  index,
  onIndexChange,
  onClose,
}: {
  fotos: GalleryFoto[];
  index: number;
  onIndexChange: (next: number) => void;
  onClose: () => void;
}) {
  const host = useOverlayPortalHost();
  const total = fotos.length;
  const atual = fotos[Math.min(Math.max(index, 0), Math.max(total - 1, 0))];

  useEffect(() => {
    if (!atual) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key === 'ArrowLeft' && total > 1) {
        event.preventDefault();
        onIndexChange((index - 1 + total) % total);
      }
      if (event.key === 'ArrowRight' && total > 1) {
        event.preventDefault();
        onIndexChange((index + 1) % total);
      }
    }
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [atual, index, total, onClose, onIndexChange]);

  if (!host || !atual || total === 0) return null;

  return createPortal(
    <div
      data-zoom-lightbox
      data-testid="image-gallery-lightbox"
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/85 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-label={atual.alt}
      onClick={onClose}
    >
      <button
        type="button"
        className="absolute top-4 right-4 inline-flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70"
        aria-label="Fechar"
        onClick={onClose}
      >
        <X className="h-5 w-5" />
      </button>

      <p
        data-testid="image-gallery-counter"
        className="absolute top-4 left-1/2 -translate-x-1/2 rounded-full bg-black/55 px-3 py-1 text-[12px] font-semibold text-white"
      >
        Foto {index + 1} de {total}
      </p>

      {total > 1 ? (
        <button
          type="button"
          data-testid="image-gallery-prev"
          className="absolute left-3 top-1/2 z-[1] inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70"
          aria-label="Anterior"
          onClick={(event) => {
            event.stopPropagation();
            onIndexChange((index - 1 + total) % total);
          }}
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
      ) : null}

      {total > 1 ? (
        <button
          type="button"
          data-testid="image-gallery-next"
          className="absolute right-3 top-1/2 z-[1] inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70"
          aria-label="Próxima"
          onClick={(event) => {
            event.stopPropagation();
            onIndexChange((index + 1) % total);
          }}
        >
          <ChevronRight className="h-6 w-6" />
        </button>
      ) : null}

      <div
        className="max-h-[min(92dvh,calc(100dvh-5rem))] max-w-[min(96vw,1100px)] overflow-auto"
        onClick={(event) => event.stopPropagation()}
      >
        <AuthenticatedImage
          key={atual.id}
          src={atual.src}
          alt={atual.alt}
          className={cn('max-h-[min(92dvh,calc(100dvh-5rem))] w-full object-contain')}
        />
      </div>
    </div>,
    host,
  );
}
