'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Activity, AlertTriangle, Building2, ClipboardCheck, DatabaseZap, Search, SlidersHorizontal } from 'lucide-react';
import { RequirePermissions } from '@/components/auth/require-permissions';
import { getOpcoesFiltroUnidades, getResumoOperacional, getUnidades, listChamadosMapa } from '@/lib/api';
import {
  ChamadoMapaItem,
  ChamadosMapaFilters,
  OperacionalResumo,
  SlaFiltro,
  TipoPendencia,
  UnidadeFilters,
  UnidadeFiltroOpcoes,
  UnidadeOperacional,
  UnidadeSituacao,
  UnidadeTipo,
} from '@/lib/types';
import { formatUnidadeTipo } from '@/lib/unidade-tipo';
import { formatRegiaoUnidade } from '@/lib/regiao-unidade';
import { MetricCard } from '@/components/metric-card';
import { OperationalMap, CcoMapMode } from '@/components/operational-map';
import { UnidadeFiltersPanel } from '@/components/unidade-filters';
import { UnidadeList } from '@/components/unidade-list';
import { UnidadeDrawer } from '@/components/cco/unidade-drawer';
import { ChamadoMapaList } from '@/components/cco/chamado-mapa-list';
import { ChamadoMapaDrawer } from '@/components/cco/chamado-mapa-drawer';
import { UnidadeAvulsoActions } from '@/components/operacional/unidade-avulso-actions';
import { TipBanner } from '@/components/help/tip-banner';
import { Hint } from '@/components/help/hint';
import { ErrorState, LoadingState } from '@/components/ui-states';
import { PageShell } from '@/components/layout/page-shell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { MetricSkeleton } from '@/components/ui/skeleton';
import { CHAMADO_STATUS_META } from '@/lib/chamado-status';

type KpiFilter = 'none' | 'pendencias';
type CcoTab = 'proprios' | 'chamados';

const DEFAULT_TIPOS_PENDENCIA: TipoPendencia[] = ['CHAMADOS', 'NAO_CONFORMIDADES', 'VISTORIAS'];

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
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
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
    setFilters({ tiposPendencia: [...DEFAULT_TIPOS_PENDENCIA] });
    setKpiFilter('none');
  }

  const tiposPendenciaSelected = filters.tiposPendencia ?? DEFAULT_TIPOS_PENDENCIA;
  const chamadosPendenciaAtivo = tiposPendenciaSelected.includes('CHAMADOS');
  const equipes = opcoesFiltro?.equipes ?? [];
  const tiposChamado = opcoesFiltro?.tiposChamado ?? [];

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

        <div className="grid shrink-0 gap-3 xl:grid-cols-[minmax(300px,340px)_minmax(0,1fr)] xl:items-start">
          <div className="cco-list-panel flex max-h-[min(1840px,calc(100dvh-120px))] min-h-[260px] flex-col overflow-hidden rounded-[var(--r-card)] border border-[var(--line)] bg-[var(--surface)] shadow-[var(--sh-sm)]">
            <div className="filters shrink-0 space-y-2 border-b border-[var(--line-2)] bg-[var(--surface)] px-3.5 py-3">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="h-4 w-4 shrink-0 text-[var(--brand)]" />
                <span className="text-[13px] font-semibold text-[var(--ink)]">
                  {tab === 'proprios' ? 'Consulta de próprios' : 'Consulta de chamados'}
                </span>
                <Hint text="Filtros aplicados simultaneamente na lista e no mapa." />
                <Button variant="ghost" size="sm" className="ml-auto h-8 shrink-0" onClick={clearFilters}>
                  Limpar
                </Button>
              </div>

              <div className="relative">
                <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[var(--ink-3)]" />
                <input
                  value={tab === 'proprios' ? (filters.search ?? '') : (chamadoFilters.search ?? '')}
                  onChange={(event) => {
                    const value = event.target.value || undefined;
                    if (tab === 'proprios') {
                      setFilters((prev) => ({ ...prev, search: value }));
                    } else {
                      setChamadoFilters((prev) => ({ ...prev, search: value }));
                    }
                  }}
                  placeholder={tab === 'proprios' ? 'Nome, código ou endereço' : 'Código, título ou endereço'}
                  className="h-[38px] w-full rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--surface)] pr-3 pl-9 text-[13px] focus:border-[var(--brand)] focus:outline-none focus:shadow-[0_0_0_3px_var(--brand-soft)]"
                />
              </div>

              {tab === 'proprios' ? (
                <>
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

                  <div>
                    <div className="mb-1 text-[11px] font-semibold text-[var(--ink-3)]">Tipos de pendência</div>
                    <div className="flex flex-wrap gap-1.5">
                      {TIPO_PENDENCIA_CHIPS.map((chip) => (
                        <Chip
                          key={chip.value}
                          active={tiposPendenciaSelected.includes(chip.value)}
                          onClick={() =>
                            setFilters((prev) => ({
                              ...prev,
                              tiposPendencia: toggleMultiValue(
                                prev.tiposPendencia,
                                chip.value,
                                DEFAULT_TIPOS_PENDENCIA,
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
                    <div>
                      <div className="mb-1 flex items-center justify-between gap-2 text-[11px] font-semibold text-[var(--ink-3)]">
                        <span>Tipo de chamado</span>
                        {filters.tiposChamadoId?.length ? (
                          <button
                            type="button"
                            className="text-[var(--brand)] hover:underline"
                            onClick={() => setFilters((prev) => ({ ...prev, tiposChamadoId: undefined }))}
                          >
                            Todos
                          </button>
                        ) : (
                          <span>Todos</span>
                        )}
                      </div>
                      <div className="flex max-h-24 flex-wrap gap-1.5 overflow-y-auto">
                        {tiposChamado.map((tipo) => {
                          const active = (filters.tiposChamadoId ?? []).includes(tipo.id);
                          return (
                            <Chip
                              key={tipo.id}
                              active={active}
                              onClick={() =>
                                setFilters((prev) => {
                                  const current = prev.tiposChamadoId ?? [];
                                  const next = active
                                    ? current.filter((item) => item !== tipo.id)
                                    : [...current, tipo.id];
                                  return { ...prev, tiposChamadoId: next.length ? next : undefined };
                                })
                              }
                            >
                              {tipo.nome}
                            </Chip>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}

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

                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={filters.regiao ?? ''}
                      onChange={(event) => setFilters((prev) => ({ ...prev, regiao: event.target.value || undefined }))}
                      className="h-9 rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--surface)] px-2 text-xs"
                    >
                      <option value="">Todas regiões</option>
                      {(opcoesFiltro?.regioes ?? []).map((regiao) => (
                        <option key={regiao} value={regiao}>
                          {formatRegiaoUnidade(regiao)}
                        </option>
                      ))}
                    </select>
                    <select
                      value={mapMode}
                      onChange={(event) => setMapMode(event.target.value as CcoMapMode)}
                      className="h-9 rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--surface)] px-2 text-xs"
                    >
                      <option value="situacao">Mapa: Localização</option>
                      <option value="notas">Mapa: Notas</option>
                    </select>
                  </div>

                  {mapMode === 'notas' ? (
                    <select
                      value={categoriaFiltroId}
                      onChange={(event) => setCategoriaFiltroId(event.target.value)}
                      className="h-9 w-full rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--surface)] px-2 text-xs"
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
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={(chamadoFilters.status ?? [])[0] ?? ''}
                      onChange={(event) =>
                        setChamadoFilters((prev) => ({
                          ...prev,
                          status: event.target.value ? [event.target.value] : undefined,
                        }))
                      }
                      className="h-9 rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--surface)] px-2 text-xs"
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
                        setChamadoFilters((prev) => ({
                          ...prev,
                          prioridade: event.target.value ? [event.target.value] : undefined,
                        }))
                      }
                      className="h-9 rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--surface)] px-2 text-xs"
                    >
                      <option value="">Todas prioridades</option>
                      {CHAMADO_PRIORIDADE_OPTIONS.map((prioridade) => (
                        <option key={prioridade} value={prioridade}>
                          {prioridade}
                        </option>
                      ))}
                    </select>
                  </div>

                  <select
                    value={(chamadoFilters.tipoChamadoId ?? [])[0] ?? ''}
                    onChange={(event) =>
                      setChamadoFilters((prev) => ({
                        ...prev,
                        tipoChamadoId: event.target.value ? [event.target.value] : undefined,
                      }))
                    }
                    className="h-9 w-full rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--surface)] px-2 text-xs"
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
                      setChamadoFilters((prev) => ({ ...prev, bairro: event.target.value || undefined }))
                    }
                    className="h-9 w-full rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--surface)] px-2 text-xs"
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
                      setChamadoFilters((prev) => ({
                        ...prev,
                        comUnidade: (event.target.value || 'TODOS') as 'TODOS' | 'COM' | 'SEM',
                      }))
                    }
                    className="h-9 w-full rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--surface)] px-2 text-xs"
                  >
                    <option value="TODOS">Vínculo próprio: Todos</option>
                    <option value="COM">Com próprio público</option>
                    <option value="SEM">Sem próprio público</option>
                  </select>
                </>
              )}

              <div className="grid grid-cols-2 gap-2">
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
                      setFilters((prev) => ({ ...prev, equipeIds }));
                    } else {
                      setChamadoFilters((prev) => ({ ...prev, equipeIds }));
                    }
                  }}
                  className="h-9 rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--surface)] px-2 text-xs"
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
                      setFilters((prev) => ({ ...prev, sla: value }));
                    } else {
                      setChamadoFilters((prev) => ({ ...prev, sla: value }));
                    }
                  }}
                  className="h-9 rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--surface)] px-2 text-xs"
                >
                  <option value="">SLA: Todos</option>
                  <option value="DENTRO">Dentro do prazo</option>
                  <option value="FORA">Fora do prazo</option>
                </select>
              </div>

              {tab === 'proprios' ? (
                <>
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
                </>
              ) : null}

              <div className="flex items-center justify-between text-xs text-[var(--ink-3)]">
                <span>
                  <b className="mono text-[var(--ink)]">
                    {tab === 'proprios' ? unidades.length : chamados.length}
                  </b>{' '}
                  resultado(s)
                </span>
                {tab === 'proprios' && filters.tipo ? (
                  <span>{formatUnidadeTipo(filters.tipo as UnidadeTipo)}</span>
                ) : null}
              </div>
            </div>

            {loading && (tab === 'proprios' ? unidades.length === 0 : chamados.length === 0) ? (
              <LoadingState label={tab === 'proprios' ? 'Carregando próprios...' : 'Carregando chamados...'} />
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

        {tab === 'proprios' ? (
          <UnidadeDrawer open={drawerOpen} unidade={selectedUnidade} onClose={() => setDrawerOpen(false)} />
        ) : (
          <ChamadoMapaDrawer open={drawerOpen} chamado={selectedChamado} onClose={() => setDrawerOpen(false)} />
        )}
      </PageShell>
    </RequirePermissions>
  );
}
