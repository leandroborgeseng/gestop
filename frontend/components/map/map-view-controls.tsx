'use client';

import { Map, Maximize2, Minimize2, Satellite } from 'lucide-react';
import { MapBasemap } from '@/lib/franca-geo';

type MapViewControlsProps = {
  basemap: MapBasemap;
  onBasemapChange: (basemap: MapBasemap) => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
};

function ControlButton({
  active,
  label,
  onClick,
  children,
}: {
  active?: boolean;
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={[
        'flex h-10 w-10 items-center justify-center rounded-[var(--md-shape-sm)] border shadow-[var(--md-elevation-2)] transition-colors',
        active
          ? 'border-[var(--color-brand-primary)] bg-[var(--color-brand-primary)] text-white'
          : 'border-[var(--md-outline-variant)] bg-[var(--md-surface)] text-[var(--md-on-surface)] hover:bg-[var(--md-surface-container-high)]',
      ].join(' ')}
    >
      {children}
    </button>
  );
}

export function MapViewControls({
  basemap,
  onBasemapChange,
  isFullscreen,
  onToggleFullscreen,
}: MapViewControlsProps) {
  return (
    <div className="gestop-map-controls pointer-events-auto absolute top-3 right-3 z-[1000] flex flex-col gap-2">
      <ControlButton
        active={basemap === 'street'}
        label="Mapa"
        onClick={() => onBasemapChange('street')}
      >
        <Map className="h-4 w-4" />
      </ControlButton>
      <ControlButton
        active={basemap === 'satellite'}
        label="Satélite"
        onClick={() => onBasemapChange('satellite')}
      >
        <Satellite className="h-4 w-4" />
      </ControlButton>
      <ControlButton
        label={isFullscreen ? 'Restaurar mapa' : 'Maximizar mapa'}
        onClick={onToggleFullscreen}
      >
        {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
      </ControlButton>
    </div>
  );
}
