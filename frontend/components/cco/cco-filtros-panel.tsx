'use client';

import { useMemo, useState } from 'react';
import { ChevronDown, Search, SlidersHorizontal } from 'lucide-react';
import { Hint } from '@/components/help/hint';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { cn } from '@/lib/cn';
import { formatRegiaoUnidade, RegiaoUnidade } from '@/lib/regiao-unidade';
import { formatUnidadeTipo } from '@/lib/unidade-tipo';
import { CHAMADO_STATUS_META } from '@/lib/chamado-status';
import {
  ChamadosMapaFilters,
  SlaFiltro,
  TipoPendencia,
  UnidadeFilters,
  UnidadeFiltroOpcoes,
  UnidadeSituacao,
  UnidadeTipo,
} from '@/lib/types';
import { CcoMapMode } from '@/components/operational-map';

const SELECT_CLASS =
  'h-9 w-full min-w-0 max-w-full rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--surface)] px-2 text-xs';

const situacaoChips: Array<{ value: UnidadeSituacao | ''; label: string; color: string }> = [
  { value: '', label: 'Todas', color: 'var(--ink-3)' },
  { value: 'OPERACIONAL', label: 'Sem pendências', color: 'var(--ok)' },
  { value: 'COM_PENDENCIAS', label: 'Pendências', color: 'var(--warn)' },
  { value: 'SEM_LOCALIZACAO', label: 'Sem GPS', color: 'var(--muted)' },
];

const TIPO_PENDENCIA_CHIPS: Array<{ value: TipoPendencia; label: string }> = [
  { value: 'CHAMADOS', label: 'Chamados' },
  { value: 'NAO_CONFORMIDADES', label: 'Não conformidades' },
  { value: 'VISTORIAS', label: 'Vistorias' },
];

const CHAMADO_STATUS_OPTIONS = Object.keys(CHAMADO_STATUS_META);
const CHAMADO_PRIORIDADE_OPTIONS = ['BAIXA', 'MEDIA', 'ALTA', 'URGENTE'];

function toggleMultiValue<T extends string>(current: T[] | undefined, value: T, allValues: T[]): T[] {
  const selected = current ?? [...allValues];
  if (selected.includes(value)) {
    const next = selected.filter((item) => item !== value);
    return next.length > 0 ? next : [...allValues];
  }
  return [...selected, value];
}

function summarizeCcoFiltros(opts: {
  tab: 'proprios' | 'chamados';
  filters: UnidadeFilters;
  chamadoFilters: ChamadosMapaFilters;
  kpiFilter: 'none' | 'pendencias';
  defaultTiposPendencia: TipoPendencia[];
  tiposChamado: Array<{ id: string; nome: string }>;
  equipes: Array<{ id: string; nome: string }>;
}): string {
  const parts: string[] = [];

  if (opts.tab === 'proprios') {
    if (opts.kpiFilter === 'pendencias' || opts.filters.situacao === 'COM_PENDENCIAS') {
      parts.push('Pendências');
    } else if (opts.filters.situacao === 'OPERACIONAL') parts.push('Sem pendências');
    else if (opts.filters.situacao === 'SEM_LOCALIZACAO') parts.push('Sem GPS');
    else if (opts.filters.situacao === 'INATIVA') parts.push('Inativas');

    const tipos = opts.filters.tiposPendencia ?? opts.defaultTiposPendencia;
    if (tipos.length > 0 && tipos.length < opts.defaultTiposPendencia.length) {
      parts.push(
        tipos
          .map((t) => TIPO_PENDENCIA_CHIPS.find((c) => c.value === t)?.label ?? t)
          .join(', '),
      );
    }
    if (opts.filters.tiposChamadoId?.length) {
      const nomes = opts.filters.tiposChamadoId
        .map((id) => opts.tiposChamado.find((t) => t.id === id)?.nome ?? id)
        .slice(0, 2);
      parts.push(
        nomes.length < opts.filters.tiposChamadoId.length
          ? `${nomes.join(', ')} +${opts.filters.tiposChamadoId.length - nomes.length}`
          : nomes.join(', '),
      );
    }
    if (opts.filters.secretariaId) parts.push('Secretaria');
    if (opts.filters.bairro) parts.push(opts.filters.bairro);
    if (opts.filters.regiao) parts.push(formatRegiaoUnidade(opts.filters.regiao as RegiaoUnidade));
    if (opts.filters.tipo) parts.push(formatUnidadeTipo(opts.filters.tipo as UnidadeTipo));
    if (opts.filters.equipeIds?.length) {
      const nome = opts.equipes.find((e) => e.id === opts.filters.equipeIds?.[0])?.nome;
      parts.push(nome ?? 'Equipe');
    }
    if (opts.filters.sla === 'FORA') parts.push('SLA fora');
    else if (opts.filters.sla === 'DENTRO') parts.push('SLA dentro');
    if (opts.filters.search?.trim()) parts.push(`“${opts.filters.search.trim()}”`);
  } else {
    if (opts.chamadoFilters.status?.length) {
      const st = opts.chamadoFilters.status[0];
      parts.push(CHAMADO_STATUS_META[st]?.label ?? st);
    }
    if (opts.chamadoFilters.prioridade?.length) parts.push(opts.chamadoFilters.prioridade[0]);
    if (opts.chamadoFilters.tipoChamadoId?.length) {
      const nome = opts.tiposChamado.find((t) => t.id === opts.chamadoFilters.tipoChamadoId?.[0])?.nome;
      parts.push(nome ?? 'Tipo');
    }
    if (opts.chamadoFilters.bairro) parts.push(opts.chamadoFilters.bairro);
    if (opts.chamadoFilters.comUnidade === 'COM') parts.push('Com próprio');
    else if (opts.chamadoFilters.comUnidade === 'SEM') parts.push('Sem próprio');
    if (opts.chamadoFilters.equipeIds?.length) {
      const nome = opts.equipes.find((e) => e.id === opts.chamadoFilters.equipeIds?.[0])?.nome;
      parts.push(nome ?? 'Equipe');
    }
    if (opts.chamadoFilters.sla === 'FORA') parts.push('SLA fora');
    else if (opts.chamadoFilters.sla === 'DENTRO') parts.push('SLA dentro');
    if (opts.chamadoFilters.search?.trim()) parts.push(`“${opts.chamadoFilters.search.trim()}”`);
  }

  return parts.length ? parts.join(' · ') : 'Nenhum filtro ativo';
}

export function CcoFiltrosPanel({
  tab,
  filters,
  onFiltersChange,
  chamadoFilters,
  onChamadoFiltersChange,
  kpiFilter,
  onSituacaoChange,
  opcoesFiltro,
  mapMode,
  onMapModeChange,
  categoriaFiltroId,
  onCategoriaFiltroChange,
  onClear,
  resultCount,
  defaultTiposPendencia,
}: {
  tab: 'proprios' | 'chamados';
  filters: UnidadeFilters;
  onFiltersChange: (next: UnidadeFilters | ((prev: UnidadeFilters) => UnidadeFilters)) => void;
  chamadoFilters: ChamadosMapaFilters;
  onChamadoFiltersChange: (
    next: ChamadosMapaFilters | ((prev: ChamadosMapaFilters) => ChamadosMapaFilters),
  ) => void;
  kpiFilter: 'none' | 'pendencias';
  onSituacaoChange: (value: UnidadeSituacao | '') => void;
  opcoesFiltro: UnidadeFiltroOpcoes | null;
  mapMode: CcoMapMode;
  onMapModeChange: (mode: CcoMapMode) => void;
  categoriaFiltroId: string;
  onCategoriaFiltroChange: (id: string) => void;
  onClear: () => void;
  resultCount: number;
  defaultTiposPendencia: TipoPendencia[];
}) {
  const [open, setOpen] = useState(false);

  const tiposPendenciaSelected = filters.tiposPendencia ?? defaultTiposPendencia;
  const chamadosPendenciaAtivo = tiposPendenciaSelected.includes('CHAMADOS');
  const equipes = opcoesFiltro?.equipes ?? [];
  const tiposChamado = opcoesFiltro?.tiposChamado ?? [];
  const tiposChamadoSelecionados = filters.tiposChamadoId ?? [];
  const tiposChamadoDisponiveis = tiposChamado.filter((tipo) => !tiposChamadoSelecionados.includes(tipo.id));

  const summary = useMemo(
    () =>
      summarizeCcoFiltros({
        tab,
        filters,
        chamadoFilters,
        kpiFilter,
        defaultTiposPendencia,
        tiposChamado,
        equipes,
      }),
    [tab, filters, chamadoFilters, kpiFilter, defaultTiposPendencia, tiposChamado, equipes],
  );

  return (
    <div className="min-w-0 shrink-0 overflow-hidden rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--surface)] shadow-[var(--sh-sm)]">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 px-3.5 py-2.5 text-left"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
      >
        <div className="flex min-w-0 items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 shrink-0 text-[var(--brand)]" />
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-[var(--ink)]">
              {tab === 'proprios' ? 'Filtros de próprios' : 'Filtros de chamados'}
            </p>
            {!open ? <p className="mt-0.5 truncate text-[11px] text-[var(--ink-3)]">{summary}</p> : null}
          </div>
          <span
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => event.stopPropagation()}
          >
            <Hint text="Filtros aplicados simultaneamente na lista e no mapa." />
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="hidden text-[11px] text-[var(--ink-3)] sm:inline">
            <b className="mono text-[var(--ink)]">{resultCount}</b> resultado(s)
          </span>
          <ChevronDown
            className={cn('h-4 w-4 shrink-0 text-[var(--ink-3)] transition-transform', open ? 'rotate-180' : '')}
          />
        </div>
      </button>

      {open ? (
        <div className="min-w-0 space-y-3 overflow-hidden border-t border-[var(--line-2)] px-3.5 py-3.5">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <div className="relative min-w-0 w-full flex-1 sm:min-w-[220px]">
              <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[var(--ink-3)]" />
              <input
                value={tab === 'proprios' ? (filters.search ?? '') : (chamadoFilters.search ?? '')}
                onChange={(event) => {
                  const value = event.target.value || undefined;
                  if (tab === 'proprios') {
                    onFiltersChange((prev) => ({ ...prev, search: value }));
                  } else {
                    onChamadoFiltersChange((prev) => ({ ...prev, search: value }));
                  }
                }}
                placeholder={tab === 'proprios' ? 'Nome, código ou endereço' : 'Código, título ou endereço'}
                className="h-[38px] w-full min-w-0 rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--surface)] pr-3 pl-9 text-[13px] focus:border-[var(--brand)] focus:outline-none focus:shadow-[0_0_0_3px_var(--brand-soft)]"
              />
            </div>
            <Button variant="ghost" size="sm" className="h-8 shrink-0" onClick={onClear}>
              Limpar
            </Button>
            <span className="text-[11px] text-[var(--ink-3)] sm:hidden">
              <b className="mono text-[var(--ink)]">{resultCount}</b> resultado(s)
            </span>
          </div>

          {tab === 'proprios' ? (
            <>
              <div className="situ-chips flex flex-wrap gap-1.5">
                {situacaoChips.map((chip) => (
                  <Chip
                    key={chip.label}
                    active={(filters.situacao ?? '') === chip.value && kpiFilter === 'none'}
                    dotColor={chip.color}
                    onClick={() => onSituacaoChange(chip.value as UnidadeSituacao | '')}
                  >
                    {chip.label}
                  </Chip>
                ))}
              </div>

              <div>
                <div className="mb-1 text-[11px] font-semibold text-[var(--ink-3)]">Tipos de pendência</div>
                <div className="flex flex-wrap gap-1.5">
                  {TIPO_PENDENCIA_CHIPS.map((chip) => (
                    <Chip
                      key={chip.value}
                      active={tiposPendenciaSelected.includes(chip.value)}
                      onClick={() =>
                        onFiltersChange((prev) => ({
                          ...prev,
                          tiposPendencia: toggleMultiValue(
                            prev.tiposPendencia,
                            chip.value,
                            defaultTiposPendencia,
                          ),
                          ...(chip.value === 'CHAMADOS' && tiposPendenciaSelected.includes('CHAMADOS')
                            ? { tiposChamadoId: undefined }
                            : {}),
                        }))
                      }
                    >
                      {chip.label}
                    </Chip>
                  ))}
                </div>
              </div>

              {chamadosPendenciaAtivo ? (
                <div className="min-w-0">
                  <div className="mb-1 flex items-center justify-between gap-2 text-[11px] font-semibold text-[var(--ink-3)]">
                    <span>Tipo de chamado</span>
                    {tiposChamadoSelecionados.length ? (
                      <button
                        type="button"
                        className="text-[var(--brand)] hover:underline"
                        onClick={() => onFiltersChange((prev) => ({ ...prev, tiposChamadoId: undefined }))}
                      >
                        Limpar tipos
                      </button>
                    ) : (
                      <span>Nenhum selecionado</span>
                    )}
                  </div>
                  <select
                    value=""
                    onChange={(event) => {
                      const id = event.target.value;
                      if (!id) return;
                      onFiltersChange((prev) => {
                        const current = prev.tiposChamadoId ?? [];
                        if (current.includes(id)) return prev;
                        return { ...prev, tiposChamadoId: [...current, id] };
                      });
                    }}
                    className={SELECT_CLASS}
                  >
                    <option value="">
                      {tiposChamadoDisponiveis.length
                        ? 'Selecionar tipo de chamado…'
                        : tiposChamado.length
                          ? 'Todos os tipos já selecionados'
                          : 'Nenhum tipo disponível'}
                    </option>
                    {tiposChamadoDisponiveis.map((tipo) => (
                      <option key={tipo.id} value={tipo.id}>
                        {tipo.nome}
                      </option>
                    ))}
                  </select>
                  {tiposChamadoSelecionados.length ? (
                    <div className="mt-2 flex min-w-0 flex-wrap gap-1.5">
                      {tiposChamadoSelecionados.map((id) => {
                        const tipo = tiposChamado.find((item) => item.id === id);
                        return (
                          <Chip
                            key={id}
                            active
                            onClick={() =>
                              onFiltersChange((prev) => {
                                const next = (prev.tiposChamadoId ?? []).filter((item) => item !== id);
                                return { ...prev, tiposChamadoId: next.length ? next : undefined };
                              })
                            }
                          >
                            {tipo?.nome ?? id} ×
                          </Chip>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              ) : null}

              <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                <select
                  value={filters.secretariaId ?? ''}
                  onChange={(event) =>
                    onFiltersChange((prev) => ({ ...prev, secretariaId: event.target.value || undefined }))
                  }
                  className={SELECT_CLASS}
                >
                  <option value="">Todas secretarias</option>
                  {(opcoesFiltro?.secretarias ?? []).map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.sigla}
                    </option>
                  ))}
                </select>
                <select
                  value={filters.bairro ?? ''}
                  onChange={(event) =>
                    onFiltersChange((prev) => ({ ...prev, bairro: event.target.value || undefined }))
                  }
                  className={SELECT_CLASS}
                >
                  <option value="">Todos bairros</option>
                  {(opcoesFiltro?.bairros ?? []).map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
                <select
                  value={filters.regiao ?? ''}
                  onChange={(event) =>
                    onFiltersChange((prev) => ({ ...prev, regiao: event.target.value || undefined }))
                  }
                  className={SELECT_CLASS}
                >
                  <option value="">Todas regiões</option>
                  {(opcoesFiltro?.regioes ?? []).map((regiao) => (
                    <option key={regiao} value={regiao}>
                      {formatRegiaoUnidade(regiao)}
                    </option>
                  ))}
                </select>
                <select
                  value={filters.tipo ?? ''}
                  onChange={(event) =>
                    onFiltersChange((prev) => ({ ...prev, tipo: event.target.value || undefined }))
                  }
                  className={SELECT_CLASS}
                >
                  <option value="">Todos tipos de próprio</option>
                  {(opcoesFiltro?.tipos ?? []).map((tipo) => (
                    <option key={tipo} value={tipo}>
                      {formatUnidadeTipo(tipo)}
                    </option>
                  ))}
                </select>
                <select
                  value={mapMode}
                  onChange={(event) => onMapModeChange(event.target.value as CcoMapMode)}
                  className={SELECT_CLASS}
                >
                  <option value="situacao">Mapa: Localização</option>
                  <option value="notas">Mapa: Notas</option>
                </select>
              </div>

              {mapMode === 'notas' ? (
                <select
                  value={categoriaFiltroId}
                  onChange={(event) => onCategoriaFiltroChange(event.target.value)}
                  className={cn(SELECT_CLASS, 'max-w-md')}
                >
                  <option value="">Nota geral (Likert)</option>
                  {(opcoesFiltro?.categoriasVistoria ?? []).map((categoria) => (
                    <option key={categoria.id} value={categoria.id}>
                      Categoria: {categoria.nome}
                    </option>
                  ))}
                </select>
              ) : null}
            </>
          ) : (
            <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              <select
                value={(chamadoFilters.status ?? [])[0] ?? ''}
                onChange={(event) =>
                  onChamadoFiltersChange((prev) => ({
                    ...prev,
                    status: event.target.value ? [event.target.value] : undefined,
                  }))
                }
                className={SELECT_CLASS}
              >
                <option value="">Todos status</option>
                {CHAMADO_STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>
                    {CHAMADO_STATUS_META[status]?.label ?? status}
                  </option>
                ))}
              </select>
              <select
                value={(chamadoFilters.prioridade ?? [])[0] ?? ''}
                onChange={(event) =>
                  onChamadoFiltersChange((prev) => ({
                    ...prev,
                    prioridade: event.target.value ? [event.target.value] : undefined,
                  }))
                }
                className={SELECT_CLASS}
              >
                <option value="">Todas prioridades</option>
                {CHAMADO_PRIORIDADE_OPTIONS.map((prioridade) => (
                  <option key={prioridade} value={prioridade}>
                    {prioridade}
                  </option>
                ))}
              </select>
              <select
                value={(chamadoFilters.tipoChamadoId ?? [])[0] ?? ''}
                onChange={(event) =>
                  onChamadoFiltersChange((prev) => ({
                    ...prev,
                    tipoChamadoId: event.target.value ? [event.target.value] : undefined,
                  }))
                }
                className={SELECT_CLASS}
              >
                <option value="">Todos tipos de chamado</option>
                {tiposChamado.map((tipo) => (
                  <option key={tipo.id} value={tipo.id}>
                    {tipo.nome}
                  </option>
                ))}
              </select>
              <select
                value={chamadoFilters.bairro ?? ''}
                onChange={(event) =>
                  onChamadoFiltersChange((prev) => ({ ...prev, bairro: event.target.value || undefined }))
                }
                className={SELECT_CLASS}
              >
                <option value="">Todos bairros</option>
                {(opcoesFiltro?.bairros ?? []).map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
              <select
                value={chamadoFilters.comUnidade ?? 'TODOS'}
                onChange={(event) =>
                  onChamadoFiltersChange((prev) => ({
                    ...prev,
                    comUnidade: (event.target.value || 'TODOS') as 'TODOS' | 'COM' | 'SEM',
                  }))
                }
                className={SELECT_CLASS}
              >
                <option value="TODOS">Vínculo próprio: Todos</option>
                <option value="COM">Com próprio público</option>
                <option value="SEM">Sem próprio público</option>
              </select>
            </div>
          )}

          <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            <select
              value={
                tab === 'proprios'
                  ? (filters.equipeIds ?? [])[0] ?? ''
                  : (chamadoFilters.equipeIds ?? [])[0] ?? ''
              }
              onChange={(event) => {
                const value = event.target.value || undefined;
                const equipeIds = value ? [value] : undefined;
                if (tab === 'proprios') {
                  onFiltersChange((prev) => ({ ...prev, equipeIds }));
                } else {
                  onChamadoFiltersChange((prev) => ({ ...prev, equipeIds }));
                }
              }}
              className={SELECT_CLASS}
            >
              <option value="">Equipe do chamado: Todas</option>
              {equipes.map((equipe) => (
                <option key={equipe.id} value={equipe.id}>
                  {equipe.nome}
                </option>
              ))}
            </select>
            <select
              value={(tab === 'proprios' ? filters.sla : chamadoFilters.sla) ?? ''}
              onChange={(event) => {
                const value = (event.target.value || undefined) as SlaFiltro | undefined;
                if (tab === 'proprios') {
                  onFiltersChange((prev) => ({ ...prev, sla: value }));
                } else {
                  onChamadoFiltersChange((prev) => ({ ...prev, sla: value }));
                }
              }}
              className={SELECT_CLASS}
            >
              <option value="">SLA: Todos</option>
              <option value="DENTRO">Dentro do prazo</option>
              <option value="FORA">Fora do prazo</option>
            </select>
          </div>
        </div>
      ) : null}
    </div>
  );
}
