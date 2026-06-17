'use client';

import { Building2, CalendarDays, Clock, MapPinOff, UsersRound } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/cn';
import { CHAMADO_STATUS_META, prazoInfo, previstaExecucaoInfo, prioridadeVariant } from '@/lib/chamado-status';
import { chamadoTitulo, chamadoLocalLabel, resolveChamadoCoordinates } from '@/lib/chamado-geo';
import { ChamadoResumo } from '@/lib/types';

export function ChamadosExecucaoList({
  chamados,
  selectedId = null,
  hoveredId = null,
  onSelect,
  onHover,
}: {
  chamados: ChamadoResumo[];
  selectedId?: string | null;
  hoveredId?: string | null;
  onSelect?: (id: string) => void;
  onHover?: (id: string | null) => void;
}) {
  if (chamados.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-10 text-center">
        <UsersRound className="mb-2 h-8 w-8 text-[var(--ink-3)]" />
        <p className="text-[14px] font-semibold text-[var(--ink)]">Nenhum chamado em execução</p>
        <p className="mt-1 text-[13px] text-[var(--ink-3)]">Altere o status para Em execução na fila geral.</p>
      </div>
    );
  }

  return (
    <div className="unit-list divide-y divide-[var(--line-2)] overflow-y-auto">
      {chamados.map((chamado) => {
        const active = selectedId === chamado.id || hoveredId === chamado.id;
        const st = CHAMADO_STATUS_META[chamado.status] ?? { label: chamado.status, badge: 'neutral' as const };
        const prazo = prazoInfo(chamado.prazoEm, chamado.status);
        const prevista = previstaExecucaoInfo(chamado.previstaExecucaoEm, chamado.status);
        const hasCoords = Boolean(resolveChamadoCoordinates(chamado));

        return (
          <button
            key={chamado.id}
            type="button"
            onClick={() => onSelect?.(chamado.id)}
            onMouseEnter={() => onHover?.(chamado.id)}
            onMouseLeave={() => onHover?.(null)}
            className={cn(
              'ch-row block w-full px-3.5 py-3 text-left transition-colors',
              active && 'is-selected bg-[var(--brand-soft)]',
            )}
          >
            <div className="ch-row-top flex items-center justify-between gap-2">
              <span className="unit-code mono text-[11px] font-semibold text-[var(--brand-hover)]">{chamado.codigo}</span>
              <Badge variant={prioridadeVariant(chamado.prioridade)}>{chamado.prioridade}</Badge>
            </div>
            <div className="unit-name mt-1 line-clamp-2 text-[14px] font-semibold text-[var(--ink)]">{chamadoTitulo(chamado)}</div>
            <div className="unit-meta mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-[var(--ink-3)]">
              <span className="inline-flex items-center gap-1">
                <Building2 className="h-3 w-3" />
                {chamadoLocalLabel(chamado)}
              </span>
              {chamado.equipe ? (
                <span className="inline-flex items-center gap-1">
                  <UsersRound className="h-3 w-3" />
                  {chamado.equipe.nome}
                </span>
              ) : null}
            </div>
            <div className="ch-row-foot mt-2 flex flex-wrap items-center gap-2">
              <Badge variant={st.badge}>{st.label}</Badge>
              <span className="ch-prazo inline-flex items-center gap-1 text-[12px] font-semibold text-[var(--ink-3)]">
                <CalendarDays className="h-3 w-3" />
                {prevista.label}
              </span>
              <span
                className={cn(
                  'ch-prazo inline-flex items-center gap-1 text-[12px] font-semibold',
                  prazo.tone === 'danger' && 'text-[var(--danger)]',
                  prazo.tone === 'warning' && 'text-[var(--warn)]',
                  prazo.tone === 'neutral' && 'text-[var(--ink-3)]',
                  prazo.tone === 'success' && 'text-[var(--ok)]',
                )}
              >
                <Clock className="h-3 w-3" />
                {prazo.value}
              </span>
              {!hasCoords ? (
                <span className="inline-flex items-center gap-1 text-[11px] text-[var(--warn)]">
                  <MapPinOff className="h-3 w-3" />
                  Sem GPS
                </span>
              ) : null}
            </div>
          </button>
        );
      })}
    </div>
  );
}
