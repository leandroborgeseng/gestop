'use client';

import type { ReactNode } from 'react';
import { Map, Maximize2, Minimize2, Satellite } from 'lucide-react';
import { MapBasemap } from '@/lib/franca-geo';
import { cn } from '@/lib/cn';

type MapViewControlsProps = {
  basemap: MapBasemap;
  onBasemapChange: (basemap: MapBasemap) => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  /** 299: controles extras abaixo da tela cheia (CCO: Filtros, Atualizar, Camadas). */
  children?: ReactNode;
  /** 299: pilha uniforme de 44 px (só no CCO; outros mapas ficam iguais). */
  alvo44?: boolean;
};

export function MapViewControls({
  basemap,
  onBasemapChange,
  isFullscreen,
  onToggleFullscreen,
  children,
  alvo44 = false,
}: MapViewControlsProps) {
  const seg = alvo44 ? 'h-10' : 'h-[30px]';
  // 301: a caixa da pilha (largura do seletor Mapa/Satélite, z 500) cobria o X e as setas do painel (z 450).
  // A caixa não recebe clique; só os filhos diretos (seletor, tela cheia e botões do CCO).
  return (
    <div className="sigma-map-controls pointer-events-none absolute top-3.5 right-3.5 z-[500] flex flex-col gap-2 *:pointer-events-auto">
      <div className="flex gap-0.5 rounded-[10px] border border-[var(--line)] bg-[rgba(255,255,255,0.94)] p-0.5 shadow-[var(--sh-sm)] backdrop-blur-md">
        <button
          type="button"
          aria-pressed={basemap === 'street'}
          onClick={() => onBasemapChange('street')}
          className={cn(
            'inline-flex items-center', seg, ' gap-1.5 rounded-[7px] px-2.5 text-xs font-semibold',
            basemap === 'street' ? 'bg-[var(--brand)] text-white shadow-[var(--sh-sm)]' : 'text-[var(--ink-3)] hover:text-[var(--ink)]',
          )}
        >
          <Map className="h-3.5 w-3.5" />
          Mapa
        </button>
        <button
          type="button"
          aria-pressed={basemap === 'satellite'}
          onClick={() => onBasemapChange('satellite')}
          className={cn(
            'inline-flex items-center', seg, ' gap-1.5 rounded-[7px] px-2.5 text-xs font-semibold',
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
        className={cn(
          'flex items-center',
          alvo44 ? 'h-11 w-11 self-end' : 'h-9 w-9',
          ' justify-center rounded-[var(--r-md)] border border-[var(--line)] bg-[rgba(255,255,255,0.94)] text-[var(--ink-2)] shadow-[var(--sh-sm)] backdrop-blur-md hover:bg-[var(--surface-2)]',
        )}
      >
        {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
      </button>
      {children}
    </div>
  );
}
