'use client';

import { useEffect, useState } from 'react';

/**
 * #311 — alvo do portal de overlays (drawer, modal, lightbox).
 * Com `requestFullscreen()` no `.sigma-map-shell`, só filhos desse elemento aparecem;
 * portais em `document.body` somem. Preferimos o fullscreen atual (ou o shell em fallback CSS).
 */
function asHost(node: Element | null | undefined): HTMLElement | null {
  // Evita `instanceof HTMLElement` (quebra no vitest/node sem DOM completo).
  if (node && typeof (node as HTMLElement).appendChild === 'function') return node as HTMLElement;
  return null;
}

export function resolveOverlayPortalHost(doc: Document = document): HTMLElement {
  const fs = asHost(doc.fullscreenElement as Element | null);
  if (fs) return fs;
  const fallback = asHost(doc.querySelector('.sigma-map-shell.sigma-map-fullscreen'));
  if (fallback) return fallback;
  return doc.body;
}

/** Reage a `fullscreenchange` (e montagem) para redesenhar o portal no host certo. */
export function useOverlayPortalHost(): HTMLElement | null {
  const [host, setHost] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const sync = () => setHost(resolveOverlayPortalHost());
    sync();
    document.addEventListener('fullscreenchange', sync);
    // Fallback CSS: classe muda sem evento nativo — observa o shell se existir.
    const shell = document.querySelector('.sigma-map-shell');
    const observer =
      shell instanceof HTMLElement
        ? new MutationObserver(sync)
        : null;
    if (shell instanceof HTMLElement && observer) {
      observer.observe(shell, { attributes: true, attributeFilter: ['class'] });
    }
    return () => {
      document.removeEventListener('fullscreenchange', sync);
      observer?.disconnect();
    };
  }, []);

  return host;
}
