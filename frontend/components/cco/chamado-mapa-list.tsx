'use client';

import Link from 'next/link';
import { MapPin, Users } from 'lucide-react';
import { ChamadoMapaItem } from '@/lib/types';
import { CHAMADO_STATUS_META, prazoInfo, prioridadeVariant } from '@/lib/chamado-status';
import { cn } from '@/lib/cn';
import { EmptyState } from '@/components/ui-states';
import { Badge } from '@/components/ui/badge';

function slaRailColor(slaMapa: ChamadoMapaItem['slaMapa']) {
  if (slaMapa === 'FORA') return 'var(--danger)';
  if (slaMapa === 'DENTRO') return 'var(--ok)';
  return 'var(--muted)';
}

export function ChamadoMapaList({
  chamados,
  selectedId = null,
  hoveredId = null,
  onSelect,
  onHover,
}: {
  chamados: ChamadoMapaItem[];
  selectedId?: string | null;
  hoveredId?: string | null;
  onSelect?: (id: string) => void;
  onHover?: (id: string | null) => void;
}) {
  if (chamados.length === 0) {
    return (
      <EmptyState
        title="Nenhum chamado encontrado"
        description="Ajuste os filtros de status, prioridade, equipe ou SLA."
      />
    );
  }

  return (
    <div className="unit-list flex min-h-0 flex-1 flex-col overflow-hidden bg-transparent">
      <div className="flex shrink-0 items-center gap-2 border-b border-[var(--line-2)] px-3.5 py-2.5">
        <h2 className="text-[13px] font-semibold text-[var(--ink)]">Chamados</h2>
        <span className="mono ml-auto rounded-[var(--r-pill)] border border-[var(--line)] bg-[var(--surface-2)] px-2 py-0.5 text-[11px] font-semibold text-[var(--ink-3)]">
          {chamados.length}
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {chamados.map((chamado) => {
          const selected = selectedId === chamado.id;
          const hovered = hoveredId === chamado.id;
          const statusMeta = CHAMADO_STATUS_META[chamado.status];
          const prazo = prazoInfo(chamado.prazoEm, chamado.status);
          const local =
            chamado.unidade?.nome ??
            chamado.enderecoTexto ??
            chamado.enderecoBairro ??
            'Sem local';

          return (
            <button
              key={chamado.id}
              type="button"
              onClick={() => onSelect?.(chamado.id)}
              onMouseEnter={() => onHover?.(chamado.id)}
              onMouseLeave={() => onHover?.(null)}
              className={cn(
                'unit-row relative flex w-full touch-manipulation gap-2.5 overflow-hidden border-y border-transparent py-[var(--row-py)] pr-3 pl-3.5 text-left transition-colors',
                'min-h-[44px]',
                selected || hovered
                  ? 'border-[color-mix(in_srgb,var(--brand)_22%,transparent)] bg-[var(--brand-soft)]'
                  : 'hover:bg-[var(--surface-2)] active:bg-[var(--surface-2)]',
              )}
            >
              <span
                className="pointer-events-none absolute inset-y-2 left-0 w-[3px] rounded-r"
                style={{ background: slaRailColor(chamado.slaMapa) }}
                aria-hidden
              />
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-1.5">
                  <span className="mono text-[11px] font-semibold text-[var(--brand-hover)]">{chamado.codigo}</span>
                  <Badge variant={statusMeta?.badge ?? 'muted'} className="text-[10px]">
                    {statusMeta?.label ?? chamado.status}
                  </Badge>
                  <Badge variant={prioridadeVariant(chamado.prioridade)} className="text-[10px]">
                    {chamado.prioridade}
                  </Badge>
                </span>
                <span className="mt-0.5 block truncate text-[13.5px] font-semibold text-[var(--ink)]">
                  {chamado.titulo?.trim() || chamado.descricao}
                </span>
                <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11.5px] text-[var(--ink-3)]">
                  <span className="font-semibold text-[var(--ink-2)]">{chamado.secretaria.sigla}</span>
                  {chamado.tipoChamado ? (
                    <>
                      <span className="text-[var(--ink-4)]">·</span>
                      <span>{chamado.tipoChamado.nome}</span>
                    </>
                  ) : null}
                </span>
                <span className="mt-1 flex flex-wrap gap-3 text-[11px] text-[var(--ink-3)]">
                  <span className="inline-flex max-w-full items-center gap-1 truncate">
                    <MapPin className="h-3 w-3 shrink-0 text-[var(--brand)]" />
                    {local}
                    {chamado.enderecoBairro || chamado.unidade?.bairro
                      ? ` · ${chamado.enderecoBairro ?? chamado.unidade?.bairro}`
                      : ''}
                  </span>
                  {chamado.equipe ? (
                    <span className="inline-flex items-center gap-1">
                      <Users className="h-3 w-3 shrink-0" />
                      {chamado.equipe.nome}
                    </span>
                  ) : null}
                </span>
              </span>
              <span className="flex shrink-0 flex-col items-end gap-1 pt-0.5">
                <span
                  className={cn(
                    'mono text-[11px] font-semibold',
                    prazo.tone === 'danger'
                      ? 'text-[var(--danger)]'
                      : prazo.tone === 'warning'
                        ? 'text-[var(--warn)]'
                        : prazo.tone === 'success'
                          ? 'text-[var(--ok)]'
                          : 'text-[var(--ink-3)]',
                  )}
                >
                  {prazo.sub ?? prazo.label}
                </span>
                <Link
                  href={`/chamados?id=${chamado.id}`}
                  onClick={(event) => event.stopPropagation()}
                  className="text-[11px] font-semibold text-[var(--brand)] hover:underline"
                >
                  Abrir
                </Link>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
