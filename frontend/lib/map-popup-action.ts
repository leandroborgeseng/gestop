export type MapPopupActionKind = 'modal' | 'navigation';

const EXIT_EVENT = 'sigma:map-exit-fullscreen';

export async function exitMapFullscreen(shell?: HTMLElement | null) {
  try {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    }
  } catch {
    // Alguns navegadores recusam exitFullscreen se o pedido não veio de gesto direto.
  }
  window.dispatchEvent(new CustomEvent(EXIT_EVENT, { detail: { shell } }));
}

export function subscribeMapFullscreenExit(handler: () => void) {
  const listener = () => handler();
  window.addEventListener(EXIT_EVENT, listener);
  return () => window.removeEventListener(EXIT_EVENT, listener);
}

/** Modal: sai da tela cheia nativa (portais React não aparecem nela). Navegação: sempre sai. */
export async function runMapPopupAction(
  kind: MapPopupActionKind,
  run: () => void,
  shell?: HTMLElement | null,
) {
  const native = Boolean(document.fullscreenElement);
  if (kind === 'navigation' || native) {
    await exitMapFullscreen(shell);
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve());
    });
  }
  run();
}

const POPUP_AUTO_PAN = { autoPan: false as const, closeOnEscapeKey: true as const };

export function mapPopupBindOptions() {
  return POPUP_AUTO_PAN;
}

function sigmaIdFromPopupSource(event: unknown): string | null {
  const popup = (event as { popup?: { _source?: { _sigmaId?: string } } })?.popup;
  return popup?._source?._sigmaId ?? null;
}

/** Fecha o balão e limpa a seleção do pin (Esc, clique no mapa, fechar popup). */
export function bindMapPinSelectionCleanup(
  map: {
    on: (event: string, handler: (event?: unknown) => void) => unknown;
    off?: (event: string, handler: (event?: unknown) => void) => unknown;
    closePopup: () => void;
  },
  opts: {
    getSelectedId: () => string | null | undefined;
    onClear: () => void;
    isMarkerClick?: (event: unknown) => boolean;
  },
) {
  const onPopupClose = (event?: unknown) => {
    const closedId = sigmaIdFromPopupSource(event);
    const selectedId = opts.getSelectedId();
    if (!selectedId) return;
    if (closedId && closedId !== selectedId) return;
    opts.onClear();
  };
  const onMapClick = (event: unknown) => {
    const target = (event as { originalEvent?: Event })?.originalEvent?.target as HTMLElement | undefined;
    if (target?.closest?.('.leaflet-marker-icon, .leaflet-popup, .sigma-map-marker')) return;
    if (opts.isMarkerClick?.(event)) return;
    map.closePopup();
    if (opts.getSelectedId()) opts.onClear();
  };
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== 'Escape') return;
    map.closePopup();
    if (opts.getSelectedId()) opts.onClear();
  };

  map.on('popupclose', onPopupClose);
  map.on('click', onMapClick);
  window.addEventListener('keydown', onKeyDown);

  return () => {
    map.off?.('popupclose', onPopupClose);
    map.off?.('click', onMapClick);
    window.removeEventListener('keydown', onKeyDown);
  };
}

export function toggleMapPinSelection(
  currentId: string | null | undefined,
  nextId: string,
  onSelect: (id: string) => void,
  onClear?: () => void,
) {
  if (currentId && currentId === nextId) {
    onClear?.();
    return;
  }
  onSelect(nextId);
}
