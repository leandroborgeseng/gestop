'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Activity, AlertTriangle, Building2, ClipboardCheck, DatabaseZap, Search, SlidersHorizontal } from 'lucide-react';
import { RequirePermissions } from '@/components/auth/require-permissions';
import { getOpcoesFiltroUnidades, getResumoOperacional, getUnidades } from '@/lib/api';
import {
  OperacionalResumo,
  UnidadeFilters,
  UnidadeFiltroOpcoes,
  UnidadeOperacional,
  UnidadeSituacao,
  UnidadeTipo,
} from '@/lib/types';
import { formatUnidadeTipo } from '@/lib/unidade-tipo';
import { MetricCard } from '@/components/metric-card';
import { OperationalMap } from '@/components/operational-map';
import { UnidadeFiltersPanel } from '@/components/unidade-filters';
import { UnidadeList } from '@/components/unidade-list';
import { UnidadeDrawer } from '@/components/cco/unidade-drawer';
import { UnidadeAvulsoActions } from '@/components/operacional/unidade-avulso-actions';
import { TipBanner } from '@/components/help/tip-banner';
import { Hint } from '@/components/help/hint';
import { ErrorState, LoadingState } from '@/components/ui-states';
import { PageShell } from '@/components/layout/page-shell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { MetricSkeleton } from '@/components/ui/skeleton';

type KpiFilter = 'none' | 'pendencias';

const situacaoChips: Array<{ value: UnidadeSituacao | ''; label: string; color: string }> = [
  { value: '', label: 'Todas', color: 'var(--ink-3)' },
  { value: 'OPERACIONAL', label: 'Operacional', color: 'var(--ok)' },
  { value: 'COM_PENDENCIAS', label: 'Pendências', color: 'var(--warn)' },
  { value: 'SEM_LOCALIZACAO', label: 'Sem GPS', color: 'var(--muted)' },
];

export default function CcoPage() {
  return (
    <Suspense fallback={<LoadingState label="Carregando CCO..." />}>
      <CcoPageContent />
    </Suspense>
  );
}

function CcoPageContent() {
  const searchParams = useSearchParams();
  const [filters, setFilters] = useState<UnidadeFilters>(() => {
    const search = searchParams.get('search');
    return search ? { search } : {};
  });
  const [kpiFilter, setKpiFilter] = useState<KpiFilter>('none');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [resumo, setResumo] = useState<OperacionalResumo | null>(null);
  const [opcoesFiltro, setOpcoesFiltro] = useState<UnidadeFiltroOpcoes | null>(null);
  const [unidades, setUnidades] = useState<UnidadeOperacional[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bootLoading, setBootLoading] = useState(true);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const selectedUnidade = useMemo(
    () => unidades.find((item) => item.id === selectedId) ?? null,
    [unidades, selectedId],
  );

  const selectUnidade = useCallback((id: string) => {
    setSelectedId(id);
    setDrawerOpen(true);
  }, []);

  const handleMapHover = useCallback((id: string | null) => {
    setHoveredId(id);
  }, []);

  useEffect(() => {
    const search = searchParams.get('search');
    if (search) setFilters((prev) => ({ ...prev, search }));
  }, [searchParams]);

  useEffect(() => {
    let active = true;

    async function loadStaticData() {
      try {
        const [nextResumo, nextOpcoes] = await Promise.all([getResumoOperacional(), getOpcoesFiltroUnidades()]);
        if (!active) return;
        setResumo(nextResumo);
        setOpcoesFiltro(nextOpcoes);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Erro inesperado ao carregar a CCO.');
      } finally {
        if (active) setBootLoading(false);
      }
    }

    void loadStaticData();
    return () => {
      active = false;
    };
  }, []);

  const effectiveFilters = useMemo(() => {
    if (kpiFilter === 'pendencias') {
      return { ...filters, situacao: 'COM_PENDENCIAS' as UnidadeSituacao };
    }
    return filters;
  }, [filters, kpiFilter]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    getUnidades(effectiveFilters)
      .then((data) => {
        if (!active) return;
        setUnidades(data);
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Erro inesperado ao carregar próprios.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [effectiveFilters]);

  const metricas = useMemo(
    () => [
      {
        id: 'total' as const,
        title: 'Próprios públicos',
        value: resumo?.totalUnidades ?? 0,
        hint: 'ativos',
        icon: Building2,
      },
      {
        id: 'fiscalizacoes' as const,
        title: 'Vistorias',
        value: resumo?.fiscalizacoesConcluidas ?? 0,
        hint: 'concluídas',
        icon: ClipboardCheck,
      },
      {
        id: 'pendencias' as const,
        title: 'Pendências',
        value: (resumo?.naoConformidadesAbertas ?? 0) + (resumo?.chamadosAbertos ?? 0),
        hint: 'NC + chamados abertos',
        icon: AlertTriangle,
        deltaTone: 'warn' as const,
      },
      {
        id: 'sync' as const,
        title: 'Sync pendente',
        value: resumo?.eventosSyncPendentes ?? 0,
        hint: 'eventos de vistoria',
        icon: DatabaseZap,
      },
    ],
    [resumo],
  );

  function toggleKpi(id: (typeof metricas)[number]['id']) {
    if (id === 'pendencias') {
      setKpiFilter((current) => (current === 'pendencias' ? 'none' : 'pendencias'));
      return;
    }
    setKpiFilter('none');
  }

  function updateSituacao(value: UnidadeSituacao | '') {
    setKpiFilter('none');
    setFilters((prev) => ({ ...prev, situacao: value || undefined }));
  }

  return (
    <RequirePermissions permissions={['dashboard.visualizar']}>
      <PageShell
      kicker="Central de Controle Operacional"
      icon={Activity}
      title="Visão operacional dos próprios públicos"
      description="Mapa e lista sincronizados — filtros, busca e seleção refletem nos dois painéis."
      action={
        <div className="flex flex-wrap items-center gap-2">
          <UnidadeAvulsoActions size="md" />
          <Badge variant="ok">RBAC ativo</Badge>
        </div>
      }
      className="min-h-0"
    >
      <TipBanner id="cco-map-list-sync">
        <b className="text-[var(--brand-hover)]">Mapa e lista trabalham juntos.</b> Filtre ou passe o mouse na lista
        para destacar o pin correspondente. Use <b>Abrir chamado</b> no topo ou no detalhe de um próprio; a triagem e o encaminhamento para campo ficam em <b>Chamados</b>. Pressione <span className="mono">?</span> para abrir o guia.
      </TipBanner>

      <section className="grid shrink-0 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {bootLoading
          ? Array.from({ length: 4 }).map((_, index) => <MetricSkeleton key={index} />)
          : metricas.map((metrica) => (
              <MetricCard
                key={metrica.id}
                title={metrica.title}
                value={metrica.value}
                hint={metrica.hint}
                icon={metrica.icon}
                deltaTone={metrica.deltaTone}
                active={metrica.id === 'pendencias' && kpiFilter === 'pendencias'}
                onClick={metrica.id === 'pendencias' || metrica.id === 'total' ? () => toggleKpi(metrica.id) : undefined}
              />
            ))}
      </section>

      {error ? (
        <div className="shrink-0">
          <ErrorState message={error} />
        </div>
      ) : null}

      <div className="grid shrink-0 gap-3 xl:grid-cols-[minmax(300px,340px)_minmax(0,1fr)] xl:items-start">
        <div className="cco-list-panel flex max-h-[min(1840px,calc(100dvh-120px))] min-h-[260px] flex-col overflow-hidden rounded-[var(--r-card)] border border-[var(--line)] bg-[var(--surface)] shadow-[var(--sh-sm)]">
          <div className="filters shrink-0 space-y-2 border-b border-[var(--line-2)] bg-[var(--surface)] px-3.5 py-3">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4 shrink-0 text-[var(--brand)]" />
              <span className="text-[13px] font-semibold text-[var(--ink)]">Consulta de próprios</span>
              <Hint text="Filtros aplicados simultaneamente na lista e no mapa." />
              <Button variant="ghost" size="sm" className="ml-auto h-8 shrink-0" onClick={() => { setFilters({}); setKpiFilter('none'); }}>
                Limpar
              </Button>
            </div>

            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[var(--ink-3)]" />
              <input
                value={filters.search ?? ''}
                onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value || undefined }))}
                placeholder="Nome, código ou endereço"
                className="h-[38px] w-full rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--surface)] pr-3 pl-9 text-[13px] focus:border-[var(--brand)] focus:outline-none focus:shadow-[0_0_0_3px_var(--brand-soft)]"
              />
            </div>

            <div className="situ-chips flex flex-wrap gap-1.5">
              {situacaoChips.map((chip) => (
                <Chip
                  key={chip.label}
                  active={(filters.situacao ?? '') === chip.value && kpiFilter === 'none'}
                  dotColor={chip.color}
                  onClick={() => updateSituacao(chip.value as UnidadeSituacao | '')}
                >
                  {chip.label}
                </Chip>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <select
                value={filters.secretariaId ?? ''}
                onChange={(event) =>
                  setFilters((prev) => ({ ...prev, secretariaId: event.target.value || undefined }))
                }
                className="h-9 rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--surface)] px-2 text-xs"
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
                onChange={(event) => setFilters((prev) => ({ ...prev, bairro: event.target.value || undefined }))}
                className="h-9 rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--surface)] px-2 text-xs"
              >
                <option value="">Todos bairros</option>
                {(opcoesFiltro?.bairros ?? []).map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              className="text-xs font-semibold text-[var(--brand)] hover:underline"
            >
              {showAdvancedFilters ? 'Ocultar filtros avançados' : 'Mais filtros (tipo, responsável, e-mail)'}
            </button>

            {showAdvancedFilters ? (
              <div className="rounded-[var(--r-md)] border border-[var(--line-2)] bg-[var(--surface-2)] p-2">
                <UnidadeFiltersPanel filters={filters} opcoes={opcoesFiltro} onChange={setFilters} embedded />
              </div>
            ) : null}

            <div className="flex items-center justify-between text-xs text-[var(--ink-3)]">
              <span>
                <b className="mono text-[var(--ink)]">{unidades.length}</b> resultado(s)
              </span>
              {filters.tipo ? <span>{formatUnidadeTipo(filters.tipo as UnidadeTipo)}</span> : null}
            </div>
          </div>

          {loading && unidades.length === 0 ? (
            <LoadingState label="Carregando próprios..." />
          ) : (
            <UnidadeList
              embedded
              unidades={unidades}
              selectedId={selectedId}
              hoveredId={hoveredId}
              onSelect={selectUnidade}
              onHover={setHoveredId}
            />
          )}
        </div>

        <OperationalMap
          unidades={unidades}
          selectedId={selectedId}
          hoveredId={hoveredId}
          onSelect={selectUnidade}
          onHover={handleMapHover}
        />
      </div>

      <UnidadeDrawer
        open={drawerOpen}
        unidade={selectedUnidade}
        onClose={() => setDrawerOpen(false)}
      />
    </PageShell>
    </RequirePermissions>
  );
}
