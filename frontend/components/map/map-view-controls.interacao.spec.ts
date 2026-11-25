import '@/test-utils/jsdom-global';
import { createElement } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MapViewControls } from './map-view-controls';

afterEach(() => cleanup());

describe('301 · pilha de controles do mapa não intercepta cliques fora dos botões', () => {
  it('caixa com pointer-events-none e filhos diretos com pointer-events-auto; botões seguem funcionando', () => {
    const onToggleFullscreen = vi.fn();
    const onBasemapChange = vi.fn();
    const { container } = render(
      createElement(MapViewControls, { basemap: 'street', onBasemapChange, isFullscreen: false, onToggleFullscreen, alvo44: true } as never,
        createElement('div', { 'data-testid': 'extra' }, createElement('button', { type: 'button' }, 'Camadas'))),
    );
    const caixa = container.querySelector('.sigma-map-controls')!;
    const cls = caixa.className.split(/\s+/);
    expect(cls).toContain('pointer-events-none');
    expect(cls).not.toContain('pointer-events-auto');
    expect(cls).toContain('*:pointer-events-auto');
    expect(cls).toContain('z-[500]'); // layout/ordem inalterados
    fireEvent.click(screen.getByRole('button', { name: 'Maximizar mapa' }));
    fireEvent.click(screen.getByRole('button', { name: /Satélite/ }));
    expect(onToggleFullscreen).toHaveBeenCalledTimes(1);
    expect(onBasemapChange).toHaveBeenCalledWith('satellite');
  });
});
