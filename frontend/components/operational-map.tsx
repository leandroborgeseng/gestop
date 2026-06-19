'use client';

import dynamic from 'next/dynamic';
import { UnidadeOperacional } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';

export type CcoMapMode = 'situacao' | 'notas';

const OperationalMapClient = dynamic(
  () => import('./operational-map-client').then((module) => module.OperationalMapClient),
  {
    ssr: false,
    loading: () => (
      <div className="sigma-map-shell w-full overflow-hidden rounded-[var(--r-card)] border border-[var(--line)] bg-[var(--surface)] shadow-[var(--sh-sm)]">
        <Skeleton className="h-full w-full rounded-none" />
      </div>
    ),
  },
);

export function OperationalMap({
  unidades,
  selectedId = null,
  hoveredId = null,
  mapMode = 'situacao',
  categoriaFiltroId = null,
  onSelect,
  onHover,
}: {
  unidades: UnidadeOperacional[];
  selectedId?: string | null;
  hoveredId?: string | null;
  mapMode?: CcoMapMode;
  categoriaFiltroId?: string | null;
  onSelect?: (id: string) => void;
  onHover?: (id: string | null) => void;
}) {
  return (
    <OperationalMapClient
      unidades={unidades}
      selectedId={selectedId}
      hoveredId={hoveredId}
      mapMode={mapMode}
      categoriaFiltroId={categoriaFiltroId}
      onSelect={onSelect}
      onHover={onHover}
    />
  );
}
