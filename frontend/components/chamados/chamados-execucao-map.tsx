'use client';

import dynamic from 'next/dynamic';
import { ChamadoMapPoint } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';

const ChamadosExecucaoMapClient = dynamic(
  () => import('./chamados-execucao-map-client').then((module) => module.ChamadosExecucaoMapClient),
  {
    ssr: false,
    loading: () => (
      <div className="gestop-map-shell h-full min-h-[200px] w-full overflow-hidden rounded-[var(--r-card)] border border-[var(--line)] bg-[var(--surface)]">
        <Skeleton className="h-full w-full rounded-none" />
      </div>
    ),
  },
);

export function ChamadosExecucaoMap({
  pontos,
  selectedId = null,
  hoveredId = null,
  onSelect,
  onHover,
}: {
  pontos: ChamadoMapPoint[];
  selectedId?: string | null;
  hoveredId?: string | null;
  onSelect?: (id: string) => void;
  onHover?: (id: string | null) => void;
}) {
  return (
    <ChamadosExecucaoMapClient
      pontos={pontos}
      selectedId={selectedId}
      hoveredId={hoveredId}
      onSelect={onSelect}
      onHover={onHover}
    />
  );
}
