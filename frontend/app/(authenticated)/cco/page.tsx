'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Activity, AlertTriangle, Building2, ClipboardCheck, DatabaseZap } from 'lucide-react';
import { RequirePermissions } from '@/components/auth/require-permissions';
import { getOpcoesFiltroUnidades, getResumoOperacional, getUnidades, listChamadosMapa } from '@/lib/api';
import { countChamadosPendenciasUnicas, countUnidadesPendenciasUnicas } from '@/lib/cco-pendencias';
import {
  ChamadoMapaItem,
  ChamadosMapaFilters,
  OperacionalResumo,
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
import { AvisoChamadosCortados, notaMapaCortado } from '@/components/cco/aviso-chamados-cortados';
import { UnidadeAvulsoActions } from '@/components/operacional/unidade-avulso-actions';
import { TipBanner } from '@/components/help/tip-banner';
import { ErrorState, LoadingState } from '@/components/ui-states';
import { PageShell } from '@/components/layout/page-shell';
import { Badge } from '@/components/ui/badge';
import { Chip } from '@/components/ui/chip';
import { MetricSkeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { CcoMapControles, CcoPainelAba } from '@/components/cco/cco-map-controles';
import { CcoMapPainel } from '@/components/cco/cco-map-painel';
import {
  CcoFiltrosSnapshot,
  DEFAULT_TIPOS_PENDENCIA,
  contarFiltrosAtivos,
  defaultChamadoFilters,
  formatarHoraBrt,
  formatarNumero,
  limparSnapshot,
  snapshotsIguais,
} from '@/lib/cco-filtros-estado';
import {
  CcoCamadasEstado,
  SIGMA_CAMADA_CHAMADOS,
  SIGMA_CAMADA_PROPRIOS,
  alternarCamada,
  alternarGrupoAberto,
  camadaLigada,
  contarCamadasAlemDoPadrao,
  desligarWebmap,
  estadoCamadasPadrao,
  lerCamadasSessao,
  salvarCamadasSessao,
  webmapLigadas,
} from '@/lib/cco-camadas';
import { webmapCamadasMapaAtivo } from '@/lib/feature-flags';
import { useArvoreCamadasWebmap } from '@/lib/use-arvore-camadas-webmap';

export const MSG_ERRO_ATUALIZAR_MAPA = 'Não foi possível atualizar o mapa. Tente novamente.';

type KpiFilter = 'none' | 'pendencias';
type CcoTab = 'proprios' | 'chamados';

/** Primeira entrada, recarga e “Limpar filtros” da aba Chamados. */
const DEFAULT_CHAMADO_FILTERS: ChamadosMapaFilters = defaultChamadoFilters();
const DEBOUNCE_CCO_CHAMADOS_MS = 300;

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
  const [chamadoFilters, setChamadoFilters] = useState<ChamadosMapaFilters>(DEFAULT_CHAMADO_FILTERS);
  const [kpiFilter, setKpiFilter] = useState<KpiFilter>('none');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [resumo, setResumo] = useState<OperacionalResumo | null>(null);
  const [opcoesFiltro, setOpcoesFiltro] = useState<UnidadeFiltroOpcoes | null>(null);
  const [unidades, setUnidades] = useState<UnidadeOperacional[]>([]);
  const [chamados, setChamados] = useState<ChamadoMapaItem[]>([]);
  const [chamadosTotal, setChamadosTotal] = useState(0);
  const [chamadosTruncado, setChamadosTruncado] = useState(false);
  const [abrirFiltros, setAbrirFiltros] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bootLoading, setBootLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [mapMode, setMapMode] = useState<CcoMapMode>('situacao');
  const [chamadoMapMode, setChamadoMapMode] = useState<'situacao' | 'calor'>('situacao');
  const [categoriaFiltroId, setCategoriaFiltroId] = useState('');

  // ── 299: painel do mapa (Filtros | Camadas), Atualizar e camadas por sessão ──────────────
  const [painelAba, setPainelAba] = useState<CcoPainelAba | null>(null);
  const [rascunho, setRascunho] = useState<CcoFiltrosSnapshot | null>(null);
  const rascunhoBaseRef = useRef<CcoFiltrosSnapshot | null>(null);
  const [avisoExterno, setAvisoExterno] = useState(false);
  const [recarga, setRecarga] = useState(0);
  /** Dados pedidos pelo painel (Aplicar/Limpar) ou pelo Atualizar: o mapa não reenquadra. */
  const [manterVista, setManterVista] = useState(false);
  const acaoMapaRef = useRef<null | 'atualizar' | 'aplicar'>(null);
  const [atualizando, setAtualizando] = useState(false);
  const atualizandoRef = useRef(false);
  const [atualizadoAs, setAtualizadoAs] = useState<string | null>(null);
  const [erroMapa, setErroMapa] = useState(false);
  const [statusMapa, setStatusMapa] = useState('');
  const [camadas, setCamadas] = useState<CcoCamadasEstado>(estadoCamadasPadrao);
  const camadasCarregadasRef = useRef(false);
  const botaoFiltrosRef = useRef<HTMLButtonElement | null>(null);
  const botaoCamadasRef = useRef<HTMLButtonElement | null>(null);
  const origemPainelRef = useRef<CcoPainelAba>('filtros');

  // D-296c: escolha das camadas vale para a sessão (Webmap desligado por padrão).
  // 299 W-OCULTO: flag desligada => nada do Webmap (sem seção, sem requisição, sem contar no selo).
  const webmapAtivo = webmapCamadasMapaAtivo();
  useEffect(() => {
    const salvo = lerCamadasSessao();
    setCamadas(webmapAtivo ? salvo : desligarWebmap(salvo));
    camadasCarregadasRef.current = true;
  }, []);
  useEffect(() => {
    if (camadasCarregadasRef.current) salvarCamadasSessao(camadas);
  }, [camadas]);

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

  /** 299: fecha a carga pedida pelo mapa. Devolve true quando o erro já foi tratado no mapa. */
  function concluirCargaMapa(ok: boolean, total: number): boolean {
    const acao = acaoMapaRef.current;
    acaoMapaRef.current = null;
    if (atualizandoRef.current) {
      atualizandoRef.current = false;
      setAtualizando(false);
    }
    const nome = tab === 'chamados' ? (total === 1 ? 'chamado' : 'chamados') : total === 1 ? 'próprio público' : 'próprios públicos';
    if (ok) {
      const hora = formatarHoraBrt(new Date());
      setAtualizadoAs(hora);
      setErroMapa(false);
      if (acao === 'atualizar') setStatusMapa(`Mapa atualizado às ${hora}. ${formatarNumero(total)} ${nome}.`);
      else if (acao === 'aplicar') setStatusMapa(`Filtros aplicados: ${formatarNumero(total)} ${nome} no mapa.`);
      return true;
    }
    if (acao) {
      // Dados e hora anteriores ficam na tela; só o alerta do mapa aparece.
      setErroMapa(true);
      setStatusMapa('');
      return true;
    }
    return false;
  }

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
        concluirCargaMapa(true, data.length);
      })
      .catch((err) => {
        if (!active) return;
        if (!concluirCargaMapa(false, 0)) {
          setError(err instanceof Error ? err.message : 'Erro inesperado ao carregar próprios.');
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [effectiveFilters, tab, recarga]);

  useEffect(() => {
    if (tab !== 'chamados') return;

    // 295: debounce (busca não consulta a cada tecla) e só a resposta mais recente é aplicada.
    let active = true;
    const timer = window.setTimeout(() => {
      setLoading(true);
      setError(null);
      listChamadosMapa(chamadoFilters)
        .then((data) => {
          if (!active) return;
          setChamados(data.items);
          setChamadosTotal(data.total);
          setChamadosTruncado(data.truncado);
          concluirCargaMapa(true, data.total);
        })
        .catch((err) => {
          if (!active) return;
          if (!concluirCargaMapa(false, 0)) {
            setError(err instanceof Error ? err.message : 'Erro inesperado ao carregar chamados.');
          }
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, DEBOUNCE_CCO_CHAMADOS_MS);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [chamadoFilters, tab, recarga]);

  useEffect(() => {
    setSelectedId(null);
    setDrawerOpen(false);
    setHoveredId(null);
    setManterVista(false); // trocar de aba volta a enquadrar os dados da aba
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
      setChamadoFilters(DEFAULT_CHAMADO_FILTERS);
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

  // ── 299: estado aplicado × rascunho do painel ──
  const aplicado = useMemo<CcoFiltrosSnapshot>(
    () => ({ filters, chamadoFilters, kpiFilter }),
    [filters, chamadoFilters, kpiFilter],
  );
  const filtrosAtivos = useMemo(() => contarFiltrosAtivos(tab, aplicado), [tab, aplicado]);
  const rascunhoPendente = Boolean(rascunho && !snapshotsIguais(rascunho, aplicado));
  const calorLigado = chamadoMapMode === 'calor';
  const camadasAlemDoPadrao = contarCamadasAlemDoPadrao(camadas, calorLigado, webmapAtivo);

  // Sanfona mudou algo com o painel aberto: o rascunho recomeça do aplicado.
  useEffect(() => {
    if (!rascunho || !rascunhoBaseRef.current) return;
    if (snapshotsIguais(rascunhoBaseRef.current, aplicado)) return;
    rascunhoBaseRef.current = aplicado;
    setRascunho(aplicado);
    setAvisoExterno(true);
  }, [aplicado]);

  useEffect(() => {
    if (!statusMapa) return;
    const t = window.setTimeout(() => setStatusMapa(''), 8000);
    return () => window.clearTimeout(t);
  }, [statusMapa]);

  const { arvore: arvoreCamadas, carregando: arvoreCarregando, erro: arvoreErro, carregar: carregarArvoreCamadas, garantir: garantirArvoreCamadas } =
    useArvoreCamadasWebmap(webmapAtivo);

  function abrirPainel(aba: CcoPainelAba) {
    if (painelAba === aba) {
      fecharPainel();
      return;
    }
    if (!painelAba) origemPainelRef.current = aba;
    if (!rascunho) {
      rascunhoBaseRef.current = aplicado;
      setRascunho(aplicado);
      setAvisoExterno(false);
    }
    if (aba === 'camadas') garantirArvoreCamadas();
    setPainelAba(aba);
  }

  function trocarAba(aba: CcoPainelAba) {
    if (aba === 'camadas') garantirArvoreCamadas();
    setPainelAba(aba);
  }

  function fecharPainel() {
    // Fechar descarta o rascunho não aplicado; o próximo abre do aplicado.
    setPainelAba(null);
    setRascunho(null);
    rascunhoBaseRef.current = null;
    setAvisoExterno(false);
    const alvo = origemPainelRef.current === 'camadas' ? botaoCamadasRef.current : botaoFiltrosRef.current;
    window.setTimeout(() => alvo?.focus(), 0);
  }

  function pedirCargaMapa(acao: 'atualizar' | 'aplicar') {
    acaoMapaRef.current = acao;
    setManterVista(true);
    setRecarga((n) => n + 1);
  }

  function atualizarMapa() {
    if (atualizandoRef.current) return; // duplo clique = 1 requisição
    atualizandoRef.current = true;
    setAtualizando(true);
    setErroMapa(false);
    pedirCargaMapa('atualizar');
  }

  function aplicarRascunho(proximo: CcoFiltrosSnapshot) {
    rascunhoBaseRef.current = proximo;
    setRascunho(proximo);
    setAvisoExterno(false);
    setFilters(proximo.filters);
    setChamadoFilters(proximo.chamadoFilters);
    setKpiFilter(proximo.kpiFilter);
    pedirCargaMapa('aplicar');
  }

  function limparPeloPainel() {
    aplicarRascunho(limparSnapshot(tab, aplicado));
    window.setTimeout(() => {
      document.querySelector<HTMLElement>('#cco-map-painel-conteudo input, #cco-map-painel-conteudo select, #cco-map-painel-conteudo button')?.focus();
    }, 0);
  }

  const rascunhoFilters = rascunho?.filters ?? filters;
  const rascunhoChamados = rascunho?.chamadoFilters ?? chamadoFilters;

  // Sanfona: aplica na hora (como antes) e o mapa volta a enquadrar os dados.
  const sanfonaFilters = useCallback((next: UnidadeFilters | ((prev: UnidadeFilters) => UnidadeFilters)) => {
    setManterVista(false);
    setFilters(next);
  }, []);
  const sanfonaChamados = useCallback(
    (next: ChamadosMapaFilters | ((prev: ChamadosMapaFilters) => ChamadosMapaFilters)) => {
      setManterVista(false);
      setChamadoFilters(next);
    },
    [],
  );

  // 295: contador mostra o total real (o mapa recebe no máximo 2.000).
  const resultCount = tab === 'proprios' ? unidades.length : chamadosTotal;
  const avisoCorte =
    tab === 'chamados' ? (
      <AvisoChamadosCortados
        visivel={chamadosTruncado}
        total={chamadosTotal}
        mostrados={chamados.length}
        onAjustar={() => setAbrirFiltros((n) => n + 1)}
      />
    ) : null;

  return (
    <RequirePermissions permissions={['dashboard.visualizar']}>
      <PageShell
        kicker="Central de Controle Operacional"
        icon={Activity}
        title="Visão operacional dos próprios públicos"
        description="Mapa e lista sincronizados - filtros, busca e seleção refletem nos dois painéis."
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
          onFiltersChange={sanfonaFilters}
          chamadoFilters={chamadoFilters}
          onChamadoFiltersChange={sanfonaChamados}
          kpiFilter={kpiFilter}
          onSituacaoChange={(value) => {
            setManterVista(false);
            updateSituacao(value);
          }}
          opcoesFiltro={opcoesFiltro}
          mapMode={mapMode}
          onMapModeChange={setMapMode}
          chamadoMapMode={chamadoMapMode}
          onChamadoMapModeChange={setChamadoMapMode}
          categoriaFiltroId={categoriaFiltroId}
          onCategoriaFiltroChange={setCategoriaFiltroId}
          onClear={() => {
            setManterVista(false);
            clearFilters();
          }}
          resultCount={resultCount}
          abrirSinal={abrirFiltros}
          defaultTiposPendencia={DEFAULT_TIPOS_PENDENCIA}
        />

        {avisoCorte}

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

          <div className="cco-map-host relative flex min-h-0 min-w-0 flex-col overflow-hidden">
            {tab === 'chamados' && chamadosTruncado ? (
              <div className="pointer-events-none absolute inset-x-2 top-2 z-[500] xl:hidden">
                <AvisoChamadosCortados espelho total={chamadosTotal} mostrados={chamados.length} />
              </div>
            ) : null}
            <OperationalMap
              notaCorte={tab === 'chamados' && chamadosTruncado ? notaMapaCortado(chamados.length) : undefined}
              view={tab === 'chamados' ? 'chamados' : 'unidades'}
              unidades={unidades}
              chamados={chamados}
              selectedId={selectedId}
              hoveredId={hoveredId}
              mapMode={tab === 'chamados' ? chamadoMapMode : mapMode}
              categoriaFiltroId={categoriaFiltroId || null}
              onSelect={selectItem}
              onClearSelection={() => setSelectedId(null)}
              onHover={handleMapHover}
              manterVista={manterVista}
              ocultarPinos={!camadaLigada(camadas, tab === 'chamados' ? SIGMA_CAMADA_CHAMADOS : SIGMA_CAMADA_PROPRIOS)}
              controlesExtra={
                <CcoMapControles
                  painelAberto={painelAba}
                  onAbrir={abrirPainel}
                  filtrosAtivos={filtrosAtivos}
                  camadasAlemDoPadrao={camadasAlemDoPadrao}
                  atualizando={atualizando}
                  onAtualizar={atualizarMapa}
                  rascunhoPendente={rascunhoPendente}
                  filtrosRef={botaoFiltrosRef}
                  camadasRef={botaoCamadasRef}
                />
              }
              alertaMapa={
                <>
                  {/* 299-U1: chip no topo à esquerda (abaixo de "N no mapa"): nunca sobre o painel nem o zoom */}
                  <span
                    role="status"
                    data-testid="cco-atualizado-as"
                    className={
                      atualizadoAs
                        ? 'self-start rounded-[var(--r-pill)] border border-[var(--line)] bg-[rgba(255,255,255,0.94)] px-2.5 py-1 text-[11.5px] font-semibold text-[var(--ink-2)] shadow-[var(--sh-sm)]'
                        : 'sr-only'
                    }
                  >
                    {atualizadoAs ? `Atualizado às ${atualizadoAs}` : ''}
                  </span>
                  {erroMapa ? (
                    <div
                      role="alert"
                      data-testid="cco-mapa-erro"
                      className="pointer-events-auto rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--surface)] p-3 text-[12.5px] text-[var(--ink)] shadow-[var(--sh-md)]"
                    >
                      {MSG_ERRO_ATUALIZAR_MAPA}
                      <div className="mt-2">
                        <Button variant="outlined" size="lg" onClick={atualizarMapa}>
                          Tentar novamente
                        </Button>
                      </div>
                    </div>
                  ) : null}
                  <div
                    role="status"
                    data-testid="cco-mapa-status"
                    className={
                      statusMapa
                        ? 'rounded-[var(--r-pill)] border border-[var(--line)] bg-[rgba(255,255,255,0.96)] px-3 py-1.5 text-xs font-semibold text-[var(--ink-2)] shadow-[var(--sh-sm)]'
                        : 'sr-only'
                    }
                  >
                    {statusMapa}
                  </div>
                </>
              }
              renderPainel={({ fullscreenMode }) =>
                painelAba ? (
                  <CcoMapPainel
                    aba={painelAba}
                    onAba={trocarAba}
                    onFechar={fecharPainel}
                    fullscreenMode={fullscreenMode}
                    tituloAba={tab === 'chamados' ? 'Todos os chamados' : 'Próprios públicos'}
                    rascunhoPendente={rascunhoPendente}
                    avisoExterno={avisoExterno}
                    podeAplicar={rascunhoPendente}
                    onAplicar={() => rascunho && aplicarRascunho(rascunho)}
                    onLimpar={limparPeloPainel}
                    filtros={
                      <CcoFiltrosPanel
                        variante="painel"
                        tab={tab}
                        filters={rascunhoFilters}
                        onFiltersChange={(next) =>
                          setRascunho((d) => {
                            const base = d ?? aplicado;
                            return { ...base, filters: typeof next === 'function' ? next(base.filters) : next };
                          })
                        }
                        chamadoFilters={rascunhoChamados}
                        onChamadoFiltersChange={(next) =>
                          setRascunho((d) => {
                            const base = d ?? aplicado;
                            return {
                              ...base,
                              chamadoFilters: typeof next === 'function' ? next(base.chamadoFilters) : next,
                            };
                          })
                        }
                        kpiFilter={rascunho?.kpiFilter ?? kpiFilter}
                        onSituacaoChange={(value) =>
                          setRascunho((d) => {
                            const base = d ?? aplicado;
                            return {
                              ...base,
                              kpiFilter: 'none',
                              filters: { ...base.filters, situacao: value || undefined },
                            };
                          })
                        }
                        opcoesFiltro={opcoesFiltro}
                        mapMode={mapMode}
                        onMapModeChange={setMapMode}
                        chamadoMapMode={chamadoMapMode}
                        onChamadoMapModeChange={setChamadoMapMode}
                        categoriaFiltroId={categoriaFiltroId}
                        onCategoriaFiltroChange={setCategoriaFiltroId}
                        onClear={limparPeloPainel}
                        resultCount={resultCount}
                        defaultTiposPendencia={DEFAULT_TIPOS_PENDENCIA}
                      />
                    }
                    camadas={{
                      estado: camadas,
                      arvore: arvoreCamadas,
                      carregando: arvoreCarregando,
                      erro: arvoreErro,
                      onTentarNovamente: carregarArvoreCamadas,
                      onAlternar: (id, ligar) => setCamadas((c) => alternarCamada(c, id, ligar)),
                      onAlternarGrupo: (g) => setCamadas((c) => alternarGrupoAberto(c, g)),
                      onDesligarTodas: () => {
                        setCamadas((c) => desligarWebmap(c));
                        setChamadoMapMode('situacao');
                      },
                      calorLigado,
                      algumaLigada: calorLigado || (webmapAtivo && webmapLigadas(camadas, arvoreCamadas).length > 0),
                      webmapAtivo,
                      onCalor: (ligar) => setChamadoMapMode(ligar ? 'calor' : 'situacao'),
                    }}
                  />
                ) : null
              }
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
