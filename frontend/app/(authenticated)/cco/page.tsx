'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Activity, AlertTriangle, Building2, ClipboardCheck, DatabaseZap } from 'lucide-react';
import { RequirePermissions } from '@/components/auth/require-permissions';
import { getOpcoesFiltroUnidades, getResumoOperacional, getUnidades, listChamadosMapa } from '@/lib/api';
import { countChamadosPendenciasUnicas, countUnidadesPendenciasUnicas } from '@/lib/cco-pendencias';
import {
  ChamadoMapaItem,
  ChamadosMapaFilters,
  OperacionalResumo,
  TipoPendencia,
  UnidadeFilters,
  UnidadeFiltroOpcoes,
  UnidadeOperacional,
  UnidadeSituacao,
} from '@/lib/types';
import { MetricCard } from '@/components/metric-card';
import { OperationalMap, CcoMapMode } from '@/components/operational-map';
import { UnidadeList } from '@/components/unidade-list';
import { UnidadeDrawer } from '@/components/cco/unidade-drawer';
import { ChamadoMapaList } from '@/components/cco/chamado-mapa-list';
import { ChamadoMapaDrawer } from '@/components/cco/chamado-mapa-drawer';
import { CcoFiltrosPanel } from '@/components/cco/cco-filtros-panel';
import { UnidadeAvulsoActions } from '@/components/operacional/unidade-avulso-actions';
import { TipBanner } from '@/components/help/tip-banner';
import { ErrorState, LoadingState } from '@/components/ui-states';
import { PageShell } from '@/components/layout/page-shell';
import { Badge } from '@/components/ui/badge';
import { Chip } from '@/components/ui/chip';
import { MetricSkeleton } from '@/components/ui/skeleton';

type KpiFilter = 'none' | 'pendencias';
type CcoTab = 'proprios' | 'chamados';

const DEFAULT_TIPOS_PENDENCIA: TipoPendencia[] = ['CHAMADOS', 'NAO_CONFORMIDADES', 'VISTORIAS'];

export default function CcoPage() {
  return (
    <Suspense fallback={<LoadingState label="Carregando CCO..." />}>
      <CcoPageContent />
    </Suspense>
  );
}

function CcoPageContent() {
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<CcoTab>('proprios');
  const [filters, setFilters] = useState<UnidadeFilters>(() => {
    const search = searchParams.get('search');
    return {
      ...(search ? { search } : {}),
      tiposPendencia: [...DEFAULT_TIPOS_PENDENCIA],
    };
  });
  const [chamadoFilters, setChamadoFilters] = useState<ChamadosMapaFilters>({});
  const [kpiFilter, setKpiFilter] = useState<KpiFilter>('none');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [resumo, setResumo] = useState<OperacionalResumo | null>(null);
  const [opcoesFiltro, setOpcoesFiltro] = useState<UnidadeFiltroOpcoes | null>(null);
  const [unidades, setUnidades] = useState<UnidadeOperacional[]>([]);
  const [chamados, setChamados] = useState<ChamadoMapaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bootLoading, setBootLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [mapMode, setMapMode] = useState<CcoMapMode>('situacao');
  const [categoriaFiltroId, setCategoriaFiltroId] = useState('');

  const selectedUnidade = useMemo(
    () => unidades.find((item) => item.id === selectedId) ?? null,
    [unidades, selectedId],
  );
  const selectedChamado = useMemo(
    () => chamados.find((item) => item.id === selectedId) ?? null,
    [chamados, selectedId],
  );

  const selectItem = useCallback((id: string) => {
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
    const base: UnidadeFilters = {
      ...filters,
      responsavel: undefined,
      responsavelEmail: undefined,
      tiposPendencia: filters.tiposPendencia?.length
        ? filters.tiposPendencia
        : [...DEFAULT_TIPOS_PENDENCIA],
    };
    if (kpiFilter === 'pendencias') {
      return { ...base, situacao: 'COM_PENDENCIAS' as UnidadeSituacao };
    }
    return base;
  }, [filters, kpiFilter]);

  useEffect(() => {
    if (tab !== 'proprios') return;

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
  }, [effectiveFilters, tab]);

  useEffect(() => {
    if (tab !== 'chamados') return;

    let active = true;
    setLoading(true);
    setError(null);

    listChamadosMapa(chamadoFilters)
      .then((data) => {
        if (!active) return;
        setChamados(data);
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Erro inesperado ao carregar chamados.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [chamadoFilters, tab]);

  useEffect(() => {
    setSelectedId(null);
    setDrawerOpen(false);
    setHoveredId(null);
  }, [tab]);

  const metricas = useMemo(() => {
    const tiposPendencia = effectiveFilters.tiposPendencia?.length
      ? effectiveFilters.tiposPendencia
      : [...DEFAULT_TIPOS_PENDENCIA];

    // Card Pendências: itens únicos na visão filtrada ativa.
    // SLA (dentro/fora) NÃO entra na soma — é só classificação visual.
    const pendenciasValue =
      tab === 'chamados'
        ? !loading || chamados.length > 0
          ? countChamadosPendenciasUnicas(chamados)
          : (resumo?.chamadosAbertos ?? 0)
        : !loading || unidades.length > 0
          ? countUnidadesPendenciasUnicas(unidades, tiposPendencia)
          : (resumo?.totalPendencias ??
            (resumo?.chamadosAbertos ?? 0) + (resumo?.vistoriasAtrasadas ?? 0));

    return [
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
        value: pendenciasValue,
        hint: 'itens únicos (sem duplicar SLA)',
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
    ];
  }, [resumo, tab, chamados, unidades, loading, effectiveFilters.tiposPendencia]);

  function toggleKpi(id: (typeof metricas)[number]['id']) {
    if (id === 'pendencias') {
      setTab('proprios');
      setKpiFilter((current) => (current === 'pendencias' ? 'none' : 'pendencias'));
      return;
    }
    if (id === 'total') {
      setTab('proprios');
      setKpiFilter('none');
    }
  }

  function updateSituacao(value: UnidadeSituacao | '') {
    setKpiFilter('none');
    setFilters((prev) => ({ ...prev, situacao: value || undefined }));
  }

  function clearFilters() {
    if (tab === 'chamados') {
      setChamadoFilters({});
      return;
    }
    setFilters({
      tiposPendencia: [...DEFAULT_TIPOS_PENDENCIA],
      secretariaId: undefined,
      secretariaIds: undefined,
      bairro: undefined,
      bairros: undefined,
      regiao: undefined,
      regioes: undefined,
      tipo: undefined,
      tipos: undefined,
      tiposChamadoId: undefined,
      equipeIds: undefined,
      situacao: undefined,
      search: undefined,
      sla: undefined,
    });
    setKpiFilter('none');
  }

  const resultCount = tab === 'proprios' ? unidades.length : chamados.length;

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
        className="min-h-0 overflow-y-auto xl:overflow-hidden"
      >
        <TipBanner id="cco-map-list-sync">
          <b className="text-[var(--brand-hover)]">Mapa e lista trabalham juntos.</b> Filtre ou passe o mouse na lista
          para destacar o pin correspondente. Use as abas para alternar entre próprios e todos os chamados. Pressione{' '}
          <span className="mono">?</span> para abrir o guia.
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

        <div className="flex shrink-0 flex-wrap gap-1.5">
          <Chip active={tab === 'proprios'} onClick={() => setTab('proprios')}>
            Próprios públicos
          </Chip>
          <Chip active={tab === 'chamados'} onClick={() => setTab('chamados')}>
            Todos os chamados
          </Chip>
        </div>

        {error ? (
          <div className="shrink-0">
            <ErrorState message={error} />
          </div>
        ) : null}

        <CcoFiltrosPanel
          tab={tab}
          filters={filters}
          onFiltersChange={setFilters}
          chamadoFilters={chamadoFilters}
          onChamadoFiltersChange={setChamadoFilters}
          kpiFilter={kpiFilter}
          onSituacaoChange={updateSituacao}
          opcoesFiltro={opcoesFiltro}
          mapMode={mapMode}
          onMapModeChange={setMapMode}
          categoriaFiltroId={categoriaFiltroId}
          onCategoriaFiltroChange={setCategoriaFiltroId}
          onClear={clearFilters}
          resultCount={resultCount}
          defaultTiposPendencia={DEFAULT_TIPOS_PENDENCIA}
        />

        <div className="cco-workspace grid min-h-0 gap-3 xl:grid-cols-[minmax(300px,340px)_minmax(0,1fr)] xl:items-stretch">
          <div className="cco-list-panel flex min-h-0 flex-col overflow-hidden rounded-[var(--r-card)] border border-[var(--line)] bg-[var(--surface)] shadow-[var(--sh-sm)]">
            <div className="flex shrink-0 items-center justify-between border-b border-[var(--line-2)] px-3.5 py-2.5 text-xs text-[var(--ink-3)]">
              <span>
                <b className="mono text-[var(--ink)]">{resultCount}</b> resultado(s)
              </span>
            </div>

            {loading && (tab === 'proprios' ? unidades.length === 0 : chamados.length === 0) ? (
              <div className="flex min-h-0 flex-1 items-center justify-center p-4">
                <LoadingState label={tab === 'proprios' ? 'Carregando próprios...' : 'Carregando chamados...'} />
              </div>
            ) : tab === 'proprios' ? (
              <UnidadeList
                embedded
                unidades={unidades}
                selectedId={selectedId}
                hoveredId={hoveredId}
                onSelect={selectItem}
                onHover={setHoveredId}
              />
            ) : (
              <ChamadoMapaList
                chamados={chamados}
                selectedId={selectedId}
                hoveredId={hoveredId}
                onSelect={selectItem}
                onHover={setHoveredId}
              />
            )}
          </div>

          <div className="cco-map-host flex min-h-0 min-w-0 flex-col overflow-hidden">
            <OperationalMap
              view={tab === 'chamados' ? 'chamados' : 'unidades'}
              unidades={unidades}
              chamados={chamados}
              selectedId={selectedId}
              hoveredId={hoveredId}
              mapMode={tab === 'chamados' ? 'situacao' : mapMode}
              categoriaFiltroId={categoriaFiltroId || null}
              onSelect={selectItem}
              onHover={handleMapHover}
            />
          </div>
        </div>

        {tab === 'proprios' ? (
          <UnidadeDrawer open={drawerOpen} unidade={selectedUnidade} onClose={() => setDrawerOpen(false)} />
        ) : (
          <ChamadoMapaDrawer open={drawerOpen} chamado={selectedChamado} onClose={() => setDrawerOpen(false)} />
        )}
      </PageShell>
    </RequirePermissions>
  );
}
