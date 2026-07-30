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
  SecretariaOption,
  SlaFiltro,
  TipoPendencia,
  UnidadeFilters,
  UnidadeFiltroOpcoes,
  UnidadeSituacao,
  UnidadeTipo,
} from '@/lib/types';
import { CcoMapMode } from '@/components/operational-map';
import { FilterMultiSelect } from '@/components/cco/filter-multi-select';

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

/** Une o valor singular legado (ex.: `secretariaId`) com o novo campo plural (ex.: `secretariaIds`). */
function mergeLegacySingular<T extends string>(plural: T[] | undefined, singular: T | undefined): T[] {
  if (plural?.length) return plural;
  return singular ? [singular] : [];
}

function summarizeList(labels: string[], max = 2): string {
  if (labels.length === 0) return '';
  const shown = labels.slice(0, max);
  return shown.length < labels.length ? `${shown.join(', ')} +${labels.length - shown.length}` : shown.join(', ');
}

function summarizeCcoFiltros(opts: {
  tab: 'proprios' | 'chamados';
  filters: UnidadeFilters;
  chamadoFilters: ChamadosMapaFilters;
  kpiFilter: 'none' | 'pendencias';
  defaultTiposPendencia: TipoPendencia[];
  tiposChamado: Array<{ id: string; nome: string }>;
  equipes: Array<{ id: string; nome: string }>;
  secretarias: SecretariaOption[];
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

    const tiposChamadoIds = opts.filters.tiposChamadoId ?? [];
    if (tiposChamadoIds.length) {
      parts.push(
        summarizeList(tiposChamadoIds.map((id) => opts.tiposChamado.find((t) => t.id === id)?.nome ?? id)),
      );
    }

    const secretariaIds = mergeLegacySingular(opts.filters.secretariaIds, opts.filters.secretariaId);
    if (secretariaIds.length) {
      parts.push(
        summarizeList(secretariaIds.map((id) => opts.secretarias.find((s) => s.id === id)?.sigla ?? id)),
      );
    }

    const bairros = mergeLegacySingular(opts.filters.bairros, opts.filters.bairro);
    if (bairros.length) parts.push(summarizeList(bairros));

    const regioes = mergeLegacySingular(opts.filters.regioes, opts.filters.regiao);
    if (regioes.length) {
      parts.push(summarizeList(regioes.map((regiao) => formatRegiaoUnidade(regiao as RegiaoUnidade))));
    }

    const tiposProprio = mergeLegacySingular(opts.filters.tipos, opts.filters.tipo);
    if (tiposProprio.length) {
      parts.push(summarizeList(tiposProprio.map((tipo) => formatUnidadeTipo(tipo as UnidadeTipo))));
    }

    const equipeIds = opts.filters.equipeIds ?? [];
    if (equipeIds.length) {
      parts.push(summarizeList(equipeIds.map((id) => opts.equipes.find((e) => e.id === id)?.nome ?? id)));
    }

    if (opts.filters.sla === 'FORA') parts.push('SLA fora');
    else if (opts.filters.sla === 'DENTRO') parts.push('SLA dentro');
    if (opts.filters.search?.trim()) parts.push(`“${opts.filters.search.trim()}”`);
  } else {
    const status = opts.chamadoFilters.status ?? [];
    if (status.length) {
      parts.push(summarizeList(status.map((st) => CHAMADO_STATUS_META[st]?.label ?? st)));
    }

    const prioridade = opts.chamadoFilters.prioridade ?? [];
    if (prioridade.length) parts.push(summarizeList(prioridade));

    const tipoChamadoIds = opts.chamadoFilters.tipoChamadoId ?? [];
    if (tipoChamadoIds.length) {
      parts.push(summarizeList(tipoChamadoIds.map((id) => opts.tiposChamado.find((t) => t.id === id)?.nome ?? id)));
    }

    const bairros = mergeLegacySingular(opts.chamadoFilters.bairros, opts.chamadoFilters.bairro);
    if (bairros.length) parts.push(summarizeList(bairros));

    if (opts.chamadoFilters.comUnidade === 'COM') parts.push('Com próprio');
    else if (opts.chamadoFilters.comUnidade === 'SEM') parts.push('Sem próprio');

    const equipeIds = opts.chamadoFilters.equipeIds ?? [];
    if (equipeIds.length) {
      parts.push(summarizeList(equipeIds.map((id) => opts.equipes.find((e) => e.id === id)?.nome ?? id)));
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
  const secretarias = opcoesFiltro?.secretarias ?? [];
  const equipes = opcoesFiltro?.equipes ?? [];
  const tiposChamado = opcoesFiltro?.tiposChamado ?? [];
  const tiposChamadoSelecionados = filters.tiposChamadoId ?? [];

  const secretariaOptions = useMemo(
    () => secretarias.map((s) => ({ value: s.id, label: s.sigla })),
    [secretarias],
  );
  const bairroOptions = useMemo(
    () => (opcoesFiltro?.bairros ?? []).map((b) => ({ value: b, label: b })),
    [opcoesFiltro],
  );
  const regiaoOptions = useMemo(
    () => (opcoesFiltro?.regioes ?? []).map((r) => ({ value: r, label: formatRegiaoUnidade(r) })),
    [opcoesFiltro],
  );
  const tipoOptions = useMemo(
    () => (opcoesFiltro?.tipos ?? []).map((t) => ({ value: t, label: formatUnidadeTipo(t) })),
    [opcoesFiltro],
  );
  const equipeOptions = useMemo(() => equipes.map((e) => ({ value: e.id, label: e.nome })), [equipes]);
  const tipoChamadoOptions = useMemo(
    () => tiposChamado.map((t) => ({ value: t.id, label: t.nome })),
    [tiposChamado],
  );
  const statusOptions = useMemo(
    () => CHAMADO_STATUS_OPTIONS.map((status) => ({ value: status, label: CHAMADO_STATUS_META[status]?.label ?? status })),
    [],
  );
  const prioridadeOptions = useMemo(
    () => CHAMADO_PRIORIDADE_OPTIONS.map((prioridade) => ({ value: prioridade, label: prioridade })),
    [],
  );

  const secretariaIdsSelected = mergeLegacySingular(filters.secretariaIds, filters.secretariaId);
  const bairrosSelected = mergeLegacySingular(filters.bairros, filters.bairro);
  const regioesSelected = mergeLegacySingular(filters.regioes, filters.regiao);
  const tiposSelected = mergeLegacySingular(filters.tipos, filters.tipo);
  const chamadoBairrosSelected = mergeLegacySingular(chamadoFilters.bairros, chamadoFilters.bairro);

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
        secretarias,
      }),
    [tab, filters, chamadoFilters, kpiFilter, defaultTiposPendencia, tiposChamado, equipes, secretarias],
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
                <FilterMultiSelect
                  label="Tipo de chamado"
                  placeholder="Selecionar tipo de chamado…"
                  options={tipoChamadoOptions}
                  selected={tiposChamadoSelecionados}
                  onChange={(next) => onFiltersChange((prev) => ({ ...prev, tiposChamadoId: next }))}
                />
              ) : null}

              <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                <FilterMultiSelect
                  label="Secretaria"
                  placeholder="Selecionar secretaria…"
                  options={secretariaOptions}
                  selected={secretariaIdsSelected}
                  onChange={(next) =>
                    onFiltersChange((prev) => ({ ...prev, secretariaIds: next, secretariaId: undefined }))
                  }
                />
                <FilterMultiSelect
                  label="Bairro"
                  placeholder="Selecionar bairro…"
                  options={bairroOptions}
                  selected={bairrosSelected}
                  onChange={(next) => onFiltersChange((prev) => ({ ...prev, bairros: next, bairro: undefined }))}
                />
                <FilterMultiSelect
                  label="Região"
                  placeholder="Selecionar região…"
                  options={regiaoOptions}
                  selected={regioesSelected}
                  onChange={(next) => onFiltersChange((prev) => ({ ...prev, regioes: next, regiao: undefined }))}
                />
                <FilterMultiSelect
                  label="Tipo de próprio"
                  placeholder="Selecionar tipo de próprio…"
                  options={tipoOptions}
                  selected={tiposSelected}
                  onChange={(next) => onFiltersChange((prev) => ({ ...prev, tipos: next, tipo: undefined }))}
                />
                <FilterMultiSelect
                  label="Equipe do chamado"
                  placeholder="Selecionar equipe…"
                  options={equipeOptions}
                  selected={filters.equipeIds ?? []}
                  onChange={(next) => onFiltersChange((prev) => ({ ...prev, equipeIds: next }))}
                />
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
              <FilterMultiSelect
                label="Status"
                placeholder="Selecionar status…"
                options={statusOptions}
                selected={chamadoFilters.status ?? []}
                onChange={(next) => onChamadoFiltersChange((prev) => ({ ...prev, status: next }))}
              />
              <FilterMultiSelect
                label="Prioridade"
                placeholder="Selecionar prioridade…"
                options={prioridadeOptions}
                selected={chamadoFilters.prioridade ?? []}
                onChange={(next) => onChamadoFiltersChange((prev) => ({ ...prev, prioridade: next }))}
              />
              <FilterMultiSelect
                label="Tipo de chamado"
                placeholder="Selecionar tipo de chamado…"
                options={tipoChamadoOptions}
                selected={chamadoFilters.tipoChamadoId ?? []}
                onChange={(next) => onChamadoFiltersChange((prev) => ({ ...prev, tipoChamadoId: next }))}
              />
              <FilterMultiSelect
                label="Bairro"
                placeholder="Selecionar bairro…"
                options={bairroOptions}
                selected={chamadoBairrosSelected}
                onChange={(next) =>
                  onChamadoFiltersChange((prev) => ({ ...prev, bairros: next, bairro: undefined }))
                }
              />
              <FilterMultiSelect
                label="Equipe do chamado"
                placeholder="Selecionar equipe…"
                options={equipeOptions}
                selected={chamadoFilters.equipeIds ?? []}
                onChange={(next) => onChamadoFiltersChange((prev) => ({ ...prev, equipeIds: next }))}
              />
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
