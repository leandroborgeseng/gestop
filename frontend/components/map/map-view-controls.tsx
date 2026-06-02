'use client';

import { Map, Maximize2, Minimize2, Satellite } from 'lucide-react';
import { MapBasemap } from '@/lib/franca-geo';
import { cn } from '@/lib/cn';

type MapViewControlsProps = {
  basemap: MapBasemap;
  onBasemapChange: (basemap: MapBasemap) => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
};

export function MapViewControls({
  basemap,
  onBasemapChange,
  isFullscreen,
  onToggleFullscreen,
}: MapViewControlsProps) {
  return (
    <div className="gestop-map-controls pointer-events-auto absolute top-3.5 right-3.5 z-[500] flex flex-col gap-2">
      <div className="flex gap-0.5 rounded-[10px] border border-[var(--line)] bg-[rgba(255,255,255,0.94)] p-0.5 shadow-[var(--sh-sm)] backdrop-blur-md">
        <button
          type="button"
          onClick={() => onBasemapChange('street')}
          className={cn(
            'inline-flex h-[30px] items-center gap-1.5 rounded-[7px] px-2.5 text-xs font-semibold',
            basemap === 'street' ? 'bg-[var(--brand)] text-white shadow-[var(--sh-sm)]' : 'text-[var(--ink-3)] hover:text-[var(--ink)]',
          )}
        >
          <Map className="h-3.5 w-3.5" />
          Mapa
        </button>
        <button
          type="button"
          onClick={() => onBasemapChange('satellite')}
          className={cn(
            'inline-flex h-[30px] items-center gap-1.5 rounded-[7px] px-2.5 text-xs font-semibold',
            basemap === 'satellite' ? 'bg-[var(--brand)] text-white shadow-[var(--sh-sm)]' : 'text-[var(--ink-3)] hover:text-[var(--ink)]',
          )}
        >
          <Satellite className="h-3.5 w-3.5" />
          Satélite
        </button>
      </div>
      <button
        type="button"
        aria-label={isFullscreen ? 'Restaurar mapa' : 'Maximizar mapa'}
        onClick={onToggleFullscreen}
        className="flex h-9 w-9 items-center justify-center rounded-[var(--r-md)] border border-[var(--line)] bg-[rgba(255,255,255,0.94)] text-[var(--ink-2)] shadow-[var(--sh-sm)] backdrop-blur-md hover:bg-[var(--surface-2)]"
      >
        {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
      </button>
    </div>
  );
}
