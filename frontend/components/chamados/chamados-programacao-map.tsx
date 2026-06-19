'use client';

import { useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { ChamadoResumo } from '@/lib/types';
import { chamadoToMapPoint } from '@/lib/chamado-geo';
import { chamadoEstaProgramado } from '@/lib/chamado-map-pin';
import { Chip } from '@/components/ui/chip';

const ChamadosExecucaoMap = dynamic(
  () => import('@/components/chamados/chamados-execucao-map').then((mod) => mod.ChamadosExecucaoMap),
  { ssr: false, loading: () => <div className="h-[320px] animate-pulse rounded-[var(--r-card)] bg-[var(--surface-2)]" /> },
);

type MapFilter = 'todos' | 'programados' | 'pendentes';

export function ChamadosProgramacaoMap({
  programados,
  pendentes,
  selectedId,
  onSelect,
}: {
  programados: ChamadoResumo[];
  pendentes: ChamadoResumo[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
}) {
  const [mapFilter, setMapFilter] = useState<MapFilter>('todos');

  const allChamados = useMemo(() => {
    const map = new Map<string, ChamadoResumo>();
    for (const chamado of programados) map.set(chamado.id, chamado);
    for (const chamado of pendentes) map.set(chamado.id, chamado);
    return [...map.values()];
  }, [programados, pendentes]);

  const filteredChamados = useMemo(() => {
    if (mapFilter === 'programados') {
      return allChamados.filter((chamado) => chamadoEstaProgramado(chamado));
    }
    if (mapFilter === 'pendentes') {
      return allChamados.filter((chamado) => !chamadoEstaProgramado(chamado));
    }
    return allChamados;
  }, [allChamados, mapFilter]);

  const pontos = filteredChamados
    .map((chamado) => {
      const base = chamadoToMapPoint(chamado);
      if (!base) return null;
      const programado = chamadoEstaProgramado(chamado);
      return {
        ...base,
        previstaExecucaoEm: chamado.previstaExecucaoEm,
        prazoEm: chamado.prazoEm,
        programado,
        equipeNome: chamado.equipe?.nome ?? null,
        label: `${chamado.codigo} · ${programado ? 'Programado' : 'Pendente'}`,
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        <Chip active={mapFilter === 'todos'} onClick={() => setMapFilter('todos')}>
          Todos
        </Chip>
        <Chip active={mapFilter === 'programados'} onClick={() => setMapFilter('programados')}>
          Programados
        </Chip>
        <Chip active={mapFilter === 'pendentes'} onClick={() => setMapFilter('pendentes')}>
          Sem programação
        </Chip>
      </div>
      {pontos.length === 0 ? (
        <div className="flex h-[320px] items-center justify-center rounded-[var(--r-card)] border border-[var(--line)] bg-[var(--surface-2)] text-[13px] text-[var(--ink-3)]">
          Nenhum chamado com localização para o filtro selecionado.
        </div>
      ) : (
        <div className="min-h-[320px]">
          <ChamadosExecucaoMap
            pontos={pontos}
            selectedId={selectedId ?? null}
            hoveredId={null}
            onSelect={(id) => onSelect?.(id)}
            onHover={() => undefined}
            popupActionLabel="Programar chamado →"
          />
        </div>
      )}
    </div>
  );
}
