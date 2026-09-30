'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { CirclePlay, Map as MapIcon, MapPinned, Search } from 'lucide-react';
import { RequirePermissions } from '@/components/auth/require-permissions';
import { useCanGerenciarChamados } from '@/components/auth/session-context';
import { ChamadosExecucaoList } from '@/components/chamados/chamados-execucao-list';
import { ExecucaoTarefasPanel } from '@/components/chamados/execucao-tarefas-panel';
import { ChamadosExecucaoMap } from '@/components/chamados/chamados-execucao-map';
import { PageShell } from '@/components/layout/page-shell';
import { TipBanner } from '@/components/help/tip-banner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui-states';
import { chamadoToMapPoint } from '@/lib/chamado-geo';
import { chamadoStatusLabel } from '@/lib/chamado-status';
import { FilterMultiSelect } from '@/components/cco/filter-multi-select';
import { useSessionUser } from '@/components/auth/session-context';
import { downloadOrdensServicoLote, listChamadosEmExecucao } from '@/lib/api';
import { useSnackbar } from '@/components/ui/snackbar';
import { ChamadosEmExecucaoGrupo } from '@/lib/types';
import { useSafeBackHref } from '@/lib/use-safe-back-href';

export function ExecucaoPage() {
  return (
    <Suspense fallback={<LoadingState label="Carregando execução..." />}>
      <ExecucaoPageContent />
    </Suspense>
  );
}

function ExecucaoPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const aba = searchParams.get('aba') === 'tarefas' ? 'tarefas' : 'chamados';
  const snackbar = useSnackbar();
  const canGerenciar = useCanGerenciarChamados();
  const backHref = useSafeBackHref(canGerenciar ? '/chamados' : '/cco');
  const sessionUser = useSessionUser();
  const [grupos, setGrupos] = useState<ChamadosEmExecucaoGrupo[]>([]);
  const [minhasEquipeIds, setMinhasEquipeIds] = useState<string[]>([]);
  const [equipeIds, setEquipeIds] = useState<string[]>([]);
  const [responsavelIds, setResponsavelIds] = useState<string[]>([]);
  const [avisoFiltro, setAvisoFiltro] = useState<string | null>(null);
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
    listChamadosEmExecucao({
      hoje: filtroHoje || undefined,
      programacaoFrom: !filtroHoje && filtroInicio ? filtroInicio : undefined,
      programacaoTo: !filtroHoje && filtroFim ? filtroFim : undefined,
    })
      .then((execData) => {
        setGrupos(execData.grupos);
        setMinhasEquipeIds(execData.minhasEquipeIds ?? []);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Falha ao carregar chamados em execução.'))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    if (aba !== 'chamados') {
      setLoading(false);
      return;
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aba, filtroHoje, filtroInicio, filtroFim]);

  const baseChamados = useMemo(() => grupos.flatMap((grupo) => grupo.chamados), [grupos]);

  const opcoesEquipe = useMemo(() => {
    const map = new Map<string, string>();
    for (const chamado of baseChamados) {
      if (chamado.equipe?.id) map.set(chamado.equipe.id, chamado.equipe.nome);
    }
    return [...map.entries()]
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'));
  }, [baseChamados]);

  const opcoesResponsavel = useMemo(() => {
    const map = new Map<string, string>();
    for (const chamado of baseChamados) {
      if (chamado.responsavel?.id) map.set(chamado.responsavel.id, chamado.responsavel.nome);
    }
    return [...map.entries()]
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'));
  }, [baseChamados]);

  const chamados = useMemo(() => {
    let items = baseChamados;
    if (equipeIds.length) {
      items = items.filter((chamado) => chamado.equipe?.id && equipeIds.includes(chamado.equipe.id));
    }
    if (responsavelIds.length) {
      items = items.filter((chamado) => chamado.responsavel?.id && responsavelIds.includes(chamado.responsavel.id));
    }
    const query = search.trim().toLowerCase();
    if (!query) return items;
    return items.filter((chamado) =>
      `${chamado.codigo} ${chamado.titulo ?? ''} ${chamado.descricao} ${chamado.unidade?.nome ?? ''} ${chamado.enderecoTexto ?? ''} ${chamado.equipe?.nome ?? ''} ${chamado.responsavel?.nome ?? ''}`
        .toLowerCase()
        .includes(query),
    );
  }, [baseChamados, equipeIds, responsavelIds, search]);

  const mapPoints = useMemo(
    () => chamados.map((chamado) => chamadoToMapPoint(chamado)).filter((item): item is NonNullable<typeof item> => Boolean(item)),
    [chamados],
  );

  const totalEmExecucao = useMemo(() => grupos.reduce((sum, grupo) => sum + grupo.chamados.length, 0), [grupos]);

  function aplicarResponsavelEu() {
    const id = sessionUser?.id;
    if (!id || !opcoesResponsavel.some((item) => item.value === id)) {
      setAvisoFiltro('Não há chamados em execução atribuídos a você no contexto atual.');
      return;
    }
    setAvisoFiltro(null);
    setResponsavelIds([id]);
  }

  function aplicarMinhasEquipes() {
    const ids = minhasEquipeIds.filter((id) => opcoesEquipe.some((item) => item.value === id));
    if (!ids.length) {
      setAvisoFiltro('Não há chamados em execução atribuídos às equipes do usuário no contexto atual.');
      return;
    }
    setAvisoFiltro(null);
    setEquipeIds(ids);
  }

  function limparFiltros() {
    setFiltroHoje(false);
    setFiltroInicio('');
    setFiltroFim('');
    setEquipeIds([]);
    setResponsavelIds([]);
    setSearch('');
    setAvisoFiltro(null);
  }

  const openExecucao = useCallback(
    (id: string) => {
      const chamado = chamados.find((item) => item.id === id);
      if (chamado && chamado.status !== 'EM_EXECUCAO') {
        const label = chamadoStatusLabel(chamado.status).toLowerCase();
        const encerrado = chamado.status === 'CONCLUIDO' || chamado.status === 'CANCELADO' || chamado.status === 'IMPEDIDO';
        snackbar.show(
          encerrado
            ? `Este chamado está ${label} e não pode ser executado.`
            : 'Somente chamados em execução podem ser abertos neste fluxo.',
          'warning',
        );
        return;
      }
      setSelectedId(id);
      router.push(`/execucao/${id}`);
    },
    [chamados, router, snackbar],
  );

  return (
    <RequirePermissions
      permissions={[
        'chamados.gerenciar',
        'chamados.executar',
        'matriz.execucao.tarefas.visualizar',
        'matriz.chamados.tarefas.visualizar',
        'matriz.chamados.tarefas_atribuidas.visualizar',
      ]}
      match="any"
    >
      <PageShell
        kicker="Operação de campo"
        icon={CirclePlay}
        title="Execução"
        description="Chamados em execução no mapa e na fila de campo. Selecione um item para registrar check-in, serviço e evidências."
        backHref={backHref}
        className="min-h-0 overflow-y-auto xl:overflow-hidden"
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
        <div className="mb-3 flex shrink-0 gap-2">
          <Chip active={aba === 'chamados'} onClick={() => router.replace('/execucao')}>
            Chamados
          </Chip>
          <Chip active={aba === 'tarefas'} onClick={() => router.replace('/execucao?aba=tarefas')}>
            Tarefas
          </Chip>
        </div>
        {aba === 'tarefas' ? <ExecucaoTarefasPanel /> : null}
        {aba === 'chamados' ? (
        <>
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

        {!loading && totalEmExecucao > 0 ? (
          <>
            <div className="mb-3 flex shrink-0 flex-wrap items-center gap-2">
              <Badge variant="warning">{chamados.length} em execução</Badge>
              <Badge variant="neutral">{mapPoints.length} no mapa</Badge>
            </div>

            <div className="mb-3 flex shrink-0 flex-wrap items-center gap-2 xl:hidden">
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

            <div className="mb-3 flex shrink-0 flex-wrap items-end gap-2">
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
                    })
                      .catch(() => undefined)
                      .finally(() => setExportando(false));
                  }}
                >
                  Emitir ordens de serviço
                </Button>
              ) : null}
            </div>

            <div className="mb-3 grid min-w-0 shrink-0 grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="min-w-0">
                <FilterMultiSelect
                  label="Responsável"
                  placeholder="Selecionar responsável…"
                  options={opcoesResponsavel}
                  selected={responsavelIds}
                  onChange={(next) => {
                    setAvisoFiltro(null);
                    setResponsavelIds(next ?? []);
                  }}
                />
                <Button type="button" variant="text" size="sm" className="mt-1 h-auto px-0 text-left text-[12px]" onClick={aplicarResponsavelEu}>
                  Atribuídos a mim como responsável
                </Button>
              </div>
              <div className="min-w-0">
                <FilterMultiSelect
                  label="Equipe"
                  placeholder="Selecionar equipe…"
                  options={opcoesEquipe}
                  selected={equipeIds}
                  onChange={(next) => {
                    setAvisoFiltro(null);
                    setEquipeIds(next ?? []);
                  }}
                />
                <Button type="button" variant="text" size="sm" className="mt-1 h-auto px-0 text-left text-[12px]" onClick={aplicarMinhasEquipes}>
                  Atribuídos às equipes que faço parte
                </Button>
              </div>
            </div>
            <p className="mb-2 text-[11px] text-[var(--ink-3)]">
              Responsável filtra chamados atribuídos diretamente ao usuário. Equipe filtra chamados vinculados às equipes selecionadas.
            </p>
            {avisoFiltro ? <p className="mb-2 text-[12px] text-[var(--ink-2)]">{avisoFiltro}</p> : null}
            <div className="mb-3">
              <Button type="button" variant="outlined" size="sm" onClick={limparFiltros}>
                Limpar filtros
              </Button>
            </div>

            <div className="cco-workspace grid min-h-0 gap-3 xl:grid-cols-[minmax(300px,340px)_minmax(0,1fr)] xl:items-stretch">
              <section
                className={`cco-list-panel flex min-h-0 flex-col overflow-hidden rounded-[var(--r-card)] border border-[var(--line)] bg-[var(--surface)] shadow-[var(--sh-sm)] ${mobilePanel === 'lista' ? 'flex' : 'hidden xl:flex'}`}
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

              <div
                className={`cco-map-host flex min-h-0 min-w-0 flex-col overflow-hidden ${mobilePanel === 'mapa' ? 'flex' : 'hidden xl:flex'}`}
              >
                <div className="mb-2 hidden shrink-0 items-center gap-2 xl:flex">
                  <MapIcon className="h-4 w-4 text-[var(--brand)]" />
                  <span className="text-[13px] font-semibold text-[var(--ink)]">Mapa operacional</span>
                  <span className="text-[12px] text-[var(--ink-3)]">- clique no pin para executar</span>
                </div>
                <section className="cco-map-panel min-h-0 flex-1 overflow-hidden">
                  <ChamadosExecucaoMap
                    pontos={mapPoints}
                    selectedId={selectedId}
                    hoveredId={hoveredId}
                    onSelect={setSelectedId}
                    onClearSelection={() => setSelectedId(null)}
                    onPopupAction={openExecucao}
                    onHover={setHoveredId}
                  />
                </section>
              </div>
            </div>
          </>
        ) : null}
        </>
        ) : null}
      </PageShell>
    </RequirePermissions>
  );
}
