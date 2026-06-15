'use client';

import dynamic from 'next/dynamic';
import { ChamadoResumo } from '@/lib/types';
import { chamadoToMapPoint } from '@/lib/chamado-geo';
import { prazoInfo } from '@/lib/chamado-status';

const ChamadosExecucaoMap = dynamic(
  () => import('@/components/chamados/chamados-execucao-map').then((mod) => mod.ChamadosExecucaoMap),
  { ssr: false, loading: () => <div className="h-[320px] animate-pulse rounded-[var(--r-card)] bg-[var(--surface-2)]" /> },
);

function pinTone(chamado: ChamadoResumo, programado: boolean) {
  const prazo = prazoInfo(chamado.prazoEm, chamado.status);
  if (prazo.tone === 'danger') return 'vencido';
  if (!programado) return 'pendente';
  if (chamado.prioridade.includes('URG') || chamado.prioridade.includes('ALTA')) return 'alta';
  if (chamado.prioridade.includes('MED')) return 'media';
  return 'baixa';
}

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
  const pontos = [...programados, ...pendentes]
    .map((chamado) => {
      const base = chamadoToMapPoint(chamado);
      if (!base) return null;
      const programado = Boolean(chamado.previstaExecucaoEm);
      return {
        ...base,
        meta: pinTone(chamado, programado),
        label: `${chamado.codigo} · ${programado ? 'Programado' : 'Pendente'}`,
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  if (pontos.length === 0) {
    return (
      <div className="flex h-[320px] items-center justify-center rounded-[var(--r-card)] border border-[var(--line)] bg-[var(--surface-2)] text-[13px] text-[var(--ink-3)]">
        Nenhum chamado com localização para exibir no mapa.
      </div>
    );
  }

  return (
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
  );
}
