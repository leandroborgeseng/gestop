'use client';

import dynamic from 'next/dynamic';
import { UnidadeOperacional } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';

const OperationalMapClient = dynamic(
  () => import('./operational-map-client').then((module) => module.OperationalMapClient),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full min-h-[340px] flex-col gap-3 rounded-[var(--r-card)] border border-[var(--line)] bg-[var(--surface)] p-4 shadow-[var(--sh-sm)]">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="min-h-[340px] flex-1 w-full rounded-[var(--r-md)]" />
      </div>
    ),
  },
);

export function OperationalMap({
  unidades,
  selectedId = null,
  hoveredId = null,
  onSelect,
  onHover,
}: {
  unidades: UnidadeOperacional[];
  selectedId?: string | null;
  hoveredId?: string | null;
  onSelect?: (id: string) => void;
  onHover?: (id: string | null) => void;
}) {
  return (
    <OperationalMapClient
      unidades={unidades}
      selectedId={selectedId}
      hoveredId={hoveredId}
      onSelect={onSelect}
      onHover={onHover}
    />
  );
}
