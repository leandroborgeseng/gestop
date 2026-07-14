'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CirclePlay, Map as MapIcon, MapPinned, Search } from 'lucide-react';
import { RequirePermissions } from '@/components/auth/require-permissions';
import { useCanGerenciarChamados } from '@/components/auth/session-context';
import { ChamadosExecucaoList } from '@/components/chamados/chamados-execucao-list';
import { ChamadosExecucaoMap } from '@/components/chamados/chamados-execucao-map';
import { PageShell } from '@/components/layout/page-shell';
import { TipBanner } from '@/components/help/tip-banner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui-states';
import { chamadoToMapPoint } from '@/lib/chamado-geo';
import { downloadOrdensServicoLote, listChamadosEmExecucao, listEquipesExecucao } from '@/lib/api';
import { toInputDate } from '@/lib/cronograma';
import { ChamadosEmExecucaoGrupo, EquipeOpcaoResumo } from '@/lib/types';

function EquipeFilterSelect({
  equipes,
  value,
  onChange,
  showSemEquipe,
}: {
  equipes: EquipeOpcaoResumo[];
  value: string | null;
  onChange: (value: string | null) => void;
  showSemEquipe?: boolean;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const sorted = useMemo(
    () =>
      [...equipes].sort((a, b) =>
        a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }),
      ),
    [equipes],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sorted;
    return sorted.filter((equipe) => {
      const label = `${equipe.nome} ${equipe.secretaria?.sigla ?? ''} ${equipe.codigo ?? ''}`.toLowerCase();
      return label.includes(q);
    });
  }, [sorted, query]);

  const selectedLabel = useMemo(() => {
    if (!value) return 'Todas as equipes';
    if (value === 'sem-equipe') return 'Sem equipe';
    const equipe = equipes.find((item) => item.id === value);
    if (!equipe) return 'Todas as equipes';
    return equipe.secretaria?.sigla ? `${equipe.nome} · ${equipe.secretaria.sigla}` : equipe.nome;
  }, [equipes, value]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  return (
    <div ref={rootRef} className="relative w-full max-w-md">
      <label htmlFor="exec-equipe-filter" className="mb-1 block text-[11px] font-semibold text-[var(--ink-3)]">
        Filtrar por equipe
      </label>
      <button
        id="exec-equipe-filter"
        type="button"
        className="flex h-9 w-full items-center justify-between rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--surface)] px-3 text-left text-[13px] text-[var(--ink)] hover:border-[#cdd8e6] focus:border-[var(--brand)] focus:outline-none focus:shadow-[0_0_0_3px_var(--brand-soft)]"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => {
          setOpen((current) => !current);
          setQuery('');
        }}
      >
        <span className="truncate">{selectedLabel}</span>
        <span className="ml-2 text-[11px] text-[var(--ink-3)]">{open ? '▲' : '▼'}</span>
      </button>
      {open ? (
        <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--surface)] shadow-[var(--sh-md)]">
          <div className="border-b border-[var(--line-2)] p-2">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar equipe…"
              className="h-9 w-full rounded-[var(--r-sm)] border border-[var(--line)] bg-[var(--surface)] px-3 text-[13px] focus:border-[var(--brand)] focus:outline-none"
              autoFocus
            />
          </div>
          <ul role="listbox" className="max-h-56 overflow-y-auto p-1">
            <li>
              <button
                type="button"
                className={`flex w-full rounded-[var(--r-sm)] px-3 py-2 text-left text-[13px] ${!value ? 'bg-[var(--brand-soft)] font-semibold text-[var(--brand-hover)]' : 'hover:bg-[var(--surface-2)]'}`}
                onClick={() => {
                  onChange(null);
                  setOpen(false);
                }}
              >
                Todas as equipes
              </button>
            </li>
            {filtered.map((equipe) => {
              const label = equipe.secretaria?.sigla ? `${equipe.nome} · ${equipe.secretaria.sigla}` : equipe.nome;
              return (
                <li key={equipe.id}>
                  <button
                    type="button"
                    className={`flex w-full rounded-[var(--r-sm)] px-3 py-2 text-left text-[13px] ${value === equipe.id ? 'bg-[var(--brand-soft)] font-semibold text-[var(--brand-hover)]' : 'hover:bg-[var(--surface-2)]'}`}
                    onClick={() => {
                      onChange(equipe.id);
                      setOpen(false);
                    }}
                  >
                    {label}
                  </button>
                </li>
              );
            })}
            {showSemEquipe ? (
              <li>
                <button
                  type="button"
                  className={`flex w-full rounded-[var(--r-sm)] px-3 py-2 text-left text-[13px] ${value === 'sem-equipe' ? 'bg-[var(--brand-soft)] font-semibold text-[var(--brand-hover)]' : 'hover:bg-[var(--surface-2)]'}`}
                  onClick={() => {
                    onChange('sem-equipe');
                    setOpen(false);
                  }}
                >
                  Sem equipe
                </button>
              </li>
            ) : null}
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-[12px] text-[var(--ink-3)]">Nenhuma equipe encontrada.</li>
            ) : null}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

export function ExecucaoPage() {
  return (
    <Suspense fallback={<LoadingState label="Carregando execução..." />}>
      <ExecucaoPageContent />
    </Suspense>
  );
}

function ExecucaoPageContent() {
  const router = useRouter();
  const canGerenciar = useCanGerenciarChamados();
  const [grupos, setGrupos] = useState<ChamadosEmExecucaoGrupo[]>([]);
  const [equipesVisiveis, setEquipesVisiveis] = useState<EquipeOpcaoResumo[]>([]);
  const [equipeFilter, setEquipeFilter] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [mobilePanel, setMobilePanel] = useState<'mapa' | 'lista'>('mapa');
  const [filtroHoje, setFiltroHoje] = useState(false);
  const [filtroInicio, setFiltroInicio] = useState('');
  const [filtroFim, setFiltroFim] = useState('');
  const [exportando, setExportando] = useState(false);

  function load() {
    setLoading(true);
    setError(null);
    Promise.all([
      listChamadosEmExecucao({
        hoje: filtroHoje || undefined,
        programacaoFrom: !filtroHoje && filtroInicio ? filtroInicio : undefined,
        programacaoTo: !filtroHoje && filtroFim ? filtroFim : undefined,
      }),
      listEquipesExecucao(),
    ])
      .then(([execData, equipesData]) => {
        setGrupos(execData.grupos);
        setEquipesVisiveis(equipesData);

        if (equipesData.length === 1) {
          setEquipeFilter(equipesData[0].id);
        } else if (equipesData.length > 1 && equipeFilter && !equipesData.some((equipe) => equipe.id === equipeFilter)) {
          setEquipeFilter(null);
        }
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Falha ao carregar chamados em execução.'))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtroHoje, filtroInicio, filtroFim]);

  const temSemEquipe = useMemo(
    () => grupos.some((grupo) => !grupo.equipe && grupo.chamados.length > 0),
    [grupos],
  );

  const mostrarFiltroEquipes = equipesVisiveis.length > 1 || (canGerenciar && temSemEquipe);

  const chamados = useMemo(() => {
    let items = grupos.flatMap((grupo) => grupo.chamados);

    if (equipeFilter === 'sem-equipe') {
      items = items.filter((chamado) => !chamado.equipe?.id);
    } else if (equipeFilter) {
      items = items.filter((chamado) => chamado.equipe?.id === equipeFilter);
    }

    const query = search.trim().toLowerCase();
    if (!query) return items;

    return items.filter((chamado) =>
      `${chamado.codigo} ${chamado.titulo ?? ''} ${chamado.descricao} ${chamado.unidade?.nome ?? ''} ${chamado.enderecoTexto ?? ''} ${chamado.equipe?.nome ?? ''}`
        .toLowerCase()
        .includes(query),
    );
  }, [grupos, equipeFilter, search]);

  const mapPoints = useMemo(
    () => chamados.map((chamado) => chamadoToMapPoint(chamado)).filter((item): item is NonNullable<typeof item> => Boolean(item)),
    [chamados],
  );

  const totalEmExecucao = useMemo(() => grupos.reduce((sum, grupo) => sum + grupo.chamados.length, 0), [grupos]);

  const equipeLabel = useMemo(() => {
    if (!equipeFilter) return null;
    if (equipeFilter === 'sem-equipe') return 'Sem equipe';
    return equipesVisiveis.find((equipe) => equipe.id === equipeFilter)?.nome ?? 'Equipe';
  }, [equipeFilter, equipesVisiveis]);

  const openExecucao = useCallback(
    (id: string) => {
      setSelectedId(id);
      router.push(`/execucao/${id}`);
    },
    [router],
  );

  return (
    <RequirePermissions permissions={['chamados.gerenciar', 'chamados.executar']} match="any">
      <PageShell
        kicker="Operação de campo"
        icon={CirclePlay}
        title="Execução"
        description="Chamados em execução no mapa e na fila de campo. Selecione um item para registrar check-in, serviço e evidências."
        backHref={canGerenciar ? '/chamados' : '/cco'}
        className="min-h-0"
        action={
          canGerenciar ? (
            <Link href="/chamados">
              <Button variant="outlined" size="sm">
                Triagem de chamados
              </Button>
            </Link>
          ) : null
        }
      >
        <TipBanner id="chamados-em-execucao-mapa">
          Mapa e lista sincronizados. Clique em um chamado para abrir a <b>execução de campo</b> — confirme presença no local,
          registre o serviço realizado e anexe fotos como evidência.
        </TipBanner>

        {error ? (
          <div className="mb-4 shrink-0">
            <ErrorState message={error} onRetry={load} />
          </div>
        ) : null}

        {loading ? <LoadingState label="Carregando chamados em execução..." /> : null}

        {!loading && totalEmExecucao === 0 ? (
          <EmptyState
            title="Nenhum chamado em execução"
            description={
              canGerenciar
                ? 'Atribua uma equipe ao chamado e altere o status para Em execução na triagem.'
                : 'Aguarde a atribuição de chamados à sua equipe pelo gestor.'
            }
          />
        ) : null}

        {!loading && totalEmExecucao > 0 && chamados.length === 0 ? (
          <EmptyState
            title="Nenhum resultado no filtro"
            description="Ajuste a busca ou selecione outra equipe para ver chamados em execução."
          />
        ) : null}

        {!loading && totalEmExecucao > 0 && chamados.length > 0 ? (
          <>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Badge variant="warning">{chamados.length} em execução</Badge>
              <Badge variant="neutral">{mapPoints.length} no mapa</Badge>
              {equipeLabel && equipesVisiveis.length !== 1 ? <Badge variant="brand">{equipeLabel}</Badge> : null}
              {equipesVisiveis.length === 1 ? (
                <Badge variant="brand">{equipesVisiveis[0].nome}</Badge>
              ) : null}
            </div>

            <div className="mb-3 flex flex-wrap items-center gap-2 xl:hidden">
              <Chip active={mobilePanel === 'mapa'} onClick={() => setMobilePanel('mapa')}>
                <span className="inline-flex items-center gap-1.5">
                  <MapIcon className="h-3.5 w-3.5" />
                  Mapa
                </span>
              </Chip>
              <Chip active={mobilePanel === 'lista'} onClick={() => setMobilePanel('lista')}>
                <span className="inline-flex items-center gap-1.5">
                  <MapPinned className="h-3.5 w-3.5" />
                  Lista
                </span>
              </Chip>
            </div>

            <div className="mb-3 flex flex-wrap items-end gap-2">
              <Chip active={filtroHoje} onClick={() => setFiltroHoje((value) => !value)}>
                Hoje
              </Chip>
              <input
                type="date"
                value={filtroInicio}
                onChange={(event) => {
                  setFiltroInicio(event.target.value);
                  setFiltroHoje(false);
                }}
                className="h-9 rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--surface)] px-3 text-[12px]"
              />
              <input
                type="date"
                value={filtroFim}
                onChange={(event) => {
                  setFiltroFim(event.target.value);
                  setFiltroHoje(false);
                }}
                className="h-9 rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--surface)] px-3 text-[12px]"
              />
              {canGerenciar ? (
                <Button
                  variant="outlined"
                  size="sm"
                  disabled={exportando || chamados.length === 0}
                  onClick={() => {
                    setExportando(true);
                    void downloadOrdensServicoLote({
                      ids: chamados.map((item) => item.id),
                      hoje: filtroHoje || undefined,
                      programacaoFrom: !filtroHoje && filtroInicio ? filtroInicio : undefined,
                      programacaoTo: !filtroHoje && filtroFim ? filtroFim : undefined,
                      equipeId: equipeFilter ?? undefined,
                    })
                      .catch(() => undefined)
                      .finally(() => setExportando(false));
                  }}
                >
                  Emitir ordens de serviço
                </Button>
              ) : null}
            </div>

            {mostrarFiltroEquipes ? (
              <div className="mb-3">
                <EquipeFilterSelect
                  equipes={equipesVisiveis}
                  value={equipeFilter}
                  onChange={setEquipeFilter}
                  showSemEquipe={canGerenciar && temSemEquipe}
                />
              </div>
            ) : null}

            <div className="grid shrink-0 gap-3 xl:grid-cols-[minmax(300px,340px)_minmax(0,1fr)] xl:items-stretch">
              <section
                className={`cco-list-panel flex max-h-[min(360px,calc(100dvh-300px))] min-h-[220px] flex-col overflow-hidden rounded-[var(--r-card)] border border-[var(--line)] bg-[var(--surface)] shadow-[var(--sh-sm)] xl:max-h-[min(460px,calc(100dvh-300px))] ${mobilePanel === 'lista' ? 'flex' : 'hidden xl:flex'}`}
              >
                <div className="filters shrink-0 border-b border-[var(--line-2)] px-3.5 py-3">
                  <div className="mb-2 flex items-center gap-2">
                    <MapPinned className="h-4 w-4 text-[var(--brand)]" />
                    <span className="text-[13px] font-semibold text-[var(--ink)]">Fila de execução</span>
                  </div>
                  <div className="relative">
                    <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[var(--ink-3)]" />
                    <input
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Buscar chamado, unidade ou equipe…"
                      className="h-[38px] w-full rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--surface)] pr-3 pl-9 text-[13px] focus:border-[var(--brand)] focus:outline-none focus:shadow-[0_0_0_3px_var(--brand-soft)]"
                    />
                  </div>
                </div>
                <ChamadosExecucaoList
                  chamados={chamados}
                  selectedId={selectedId}
                  hoveredId={hoveredId}
                  onSelect={openExecucao}
                  onHover={setHoveredId}
                />
              </section>

              <section
                className={`cco-map-panel min-h-[min(420px,52vh)] ${mobilePanel === 'mapa' ? 'block' : 'hidden xl:block'}`}
              >
                <div className="mb-2 hidden items-center gap-2 xl:flex">
                  <MapIcon className="h-4 w-4 text-[var(--brand)]" />
                  <span className="text-[13px] font-semibold text-[var(--ink)]">Mapa operacional</span>
                  <span className="text-[12px] text-[var(--ink-3)]">— clique no pin para executar</span>
                </div>
                <ChamadosExecucaoMap
                  pontos={mapPoints}
                  selectedId={selectedId}
                  hoveredId={hoveredId}
                  onSelect={openExecucao}
                  onHover={setHoveredId}
                />
              </section>
            </div>
          </>
        ) : null}
      </PageShell>
    </RequirePermissions>
  );
}
