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
