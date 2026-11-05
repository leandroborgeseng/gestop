import { describe, expect, it } from 'vitest';
import { resolveOverlayPortalHost } from './overlay-portal-host';

function el(nodeName: string) {
  return { nodeName, appendChild: () => undefined } as unknown as HTMLElement;
}

describe('#311 CCO-V11 — portal sob fullscreen', () => {
  it('usa document.fullscreenElement quando houver', () => {
    const body = el('BODY');
    const shell = el('DIV');
    const doc = {
      body,
      fullscreenElement: shell,
      querySelector: () => null,
    } as unknown as Document;
    expect(resolveOverlayPortalHost(doc)).toBe(shell);
  });

  it('usa .sigma-map-shell.sigma-map-fullscreen no fallback CSS', () => {
    const body = el('BODY');
    const shell = el('DIV');
    const doc = {
      body,
      fullscreenElement: null,
      querySelector: (sel: string) => (sel.includes('sigma-map-fullscreen') ? shell : null),
    } as unknown as Document;
    expect(resolveOverlayPortalHost(doc)).toBe(shell);
  });

  it('cai no body sem fullscreen', () => {
    const body = el('BODY');
    const doc = {
      body,
      fullscreenElement: null,
      querySelector: () => null,
    } as unknown as Document;
    expect(resolveOverlayPortalHost(doc)).toBe(body);
  });
});
