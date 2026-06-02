'use client';

import { Building2, ClipboardList, LocateFixed, Mail, UserRound } from 'lucide-react';
import { UnidadeOperacional } from '@/lib/types';
import { formatUnidadeTipo } from '@/lib/unidade-tipo';
import { cn } from '@/lib/cn';
import { StatusBadge, situacaoRailColor } from './status-badge';
import { EmptyState } from './ui-states';

export function UnidadeList({
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

  if (unidades.length === 0) {
    return (
      <EmptyState
        title="Nenhum próprio encontrado"
        description="Ajuste os filtros ou cadastre novos próprios na administração."
      />
    );
  }

  return (
    <div className="unit-list flex min-h-0 flex-1 flex-col overflow-hidden rounded-[var(--r-card)] border border-[var(--line)] bg-[var(--surface)] shadow-[var(--sh-sm)]">
      <div className="flex shrink-0 items-center gap-2 border-b border-[var(--line-2)] px-4 py-3">
        <h2 className="text-[13.5px] font-semibold text-[var(--ink)]">Próprios públicos</h2>
        <span className="mono ml-auto rounded-[var(--r-pill)] border border-[var(--line)] bg-[var(--surface-2)] px-2 py-0.5 text-xs font-semibold text-[var(--ink-3)]">
          {unidades.length}
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
        {unidades.map((unidade) => {
          const selected = selectedId === unidade.id;
          const hovered = hoveredId === unidade.id;
          const hasGps = unidade.latitude !== null && unidade.longitude !== null;

          return (
            <button
              key={unidade.id}
              type="button"
              onClick={() => onSelect?.(unidade.id)}
              onMouseEnter={() => onHover?.(unidade.id)}
              onMouseLeave={() => onHover?.(null)}
              className={cn(
                'unit-row mb-0.5 flex w-full gap-2.5 overflow-hidden rounded-[var(--r-md)] border border-transparent py-[var(--row-py)] pr-2.5 pl-0 text-left transition-colors',
                selected || hovered
                  ? 'border-[color-mix(in_srgb,var(--brand)_30%,transparent)] bg-[var(--brand-soft)]'
                  : 'hover:bg-[var(--surface-2)]',
              )}
            >
              <span
                className="w-[3px] shrink-0 self-stretch rounded-r"
                style={{ background: situacaoRailColor(unidade.situacao) }}
                aria-hidden
              />
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-1.5">
                  <span className="mono text-[11px] font-semibold text-[var(--brand-hover)]">
                    {unidade.codigoPatrimonial}
                  </span>
                  {!hasGps ? (
                    <span className="inline-flex items-center gap-0.5 rounded-[var(--r-pill)] bg-[var(--muted-bg)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--muted)]">
                      <LocateFixed className="h-3 w-3" /> Sem GPS
                    </span>
                  ) : null}
                  <StatusBadge situacao={unidade.situacao} size="sm" />
                </span>
                <span className="mt-0.5 block truncate text-[13.5px] font-semibold text-[var(--ink)]">{unidade.nome}</span>
                <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11.5px] text-[var(--ink-3)]">
                  <span className="font-semibold text-[var(--ink-2)]">{unidade.secretaria.sigla}</span>
                  <span className="text-[var(--ink-4)]">·</span>
                  <span>{formatUnidadeTipo(unidade.tipo)}</span>
                  {unidade.bairro ? (
                    <>
                      <span className="text-[var(--ink-4)]">·</span>
                      <span>{unidade.bairro}</span>
                    </>
                  ) : null}
                </span>
                {(unidade.secretaria.responsavelNome || unidade.endereco) && (
                  <span className="mt-1 flex flex-wrap gap-3 text-[11px] text-[var(--ink-3)]">
                    {unidade.endereco ? (
                      <span className="inline-flex max-w-full items-center gap-1 truncate">
                        <Building2 className="h-3 w-3 shrink-0 text-[var(--brand)]" />
                        {unidade.endereco}
                      </span>
                    ) : null}
                    {unidade.secretaria.responsavelNome ? (
                      <span className="inline-flex items-center gap-1">
                        <UserRound className="h-3 w-3 shrink-0" />
                        {unidade.secretaria.responsavelNome}
                      </span>
                    ) : null}
                    {unidade.secretaria.responsavelEmail ? (
                      <span className="inline-flex items-center gap-1">
                        <Mail className="h-3 w-3 shrink-0" />
                        {unidade.secretaria.responsavelEmail}
                      </span>
                    ) : null}
                  </span>
                )}
              </span>
              <span className="flex shrink-0 flex-col items-end gap-1 pt-0.5">
                <span className="flex gap-1">
                  {unidade.pendencias.naoConformidadesAbertas > 0 ? (
                    <span className="mono inline-flex items-center rounded-md bg-[var(--warn-bg)] px-1 py-0.5 text-[11px] font-bold text-[var(--warn)]">
                      {unidade.pendencias.naoConformidadesAbertas} NC
                    </span>
                  ) : null}
                  {unidade.pendencias.ordensServicoAbertas > 0 ? (
                    <span className="mono inline-flex items-center rounded-md bg-[var(--brand-soft)] px-1 py-0.5 text-[11px] font-bold text-[var(--brand-bright)]">
                      {unidade.pendencias.ordensServicoAbertas} OS
                    </span>
                  ) : null}
                </span>
                <span className="mono text-[11px] text-[var(--ok)]">{unidade.totais.fiscalizacoes} vist.</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
