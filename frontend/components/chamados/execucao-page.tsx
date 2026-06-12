'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
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
import { listChamadosEmExecucao, listEquipesExecucao } from '@/lib/api';
import { ChamadosEmExecucaoGrupo, EquipeOpcaoResumo } from '@/lib/types';

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

  function load() {
    setLoading(true);
    setError(null);
    Promise.all([listChamadosEmExecucao(), listEquipesExecucao()])
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
  }, []);

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

            {mostrarFiltroEquipes ? (
              <div className="mb-3 flex flex-wrap gap-2">
                {equipesVisiveis.length > 1 ? (
                  <Chip active={!equipeFilter} onClick={() => setEquipeFilter(null)}>
                    Todas as equipes
                  </Chip>
                ) : null}
                {equipesVisiveis.map((equipe) => (
                  <Chip
                    key={equipe.id}
                    active={equipeFilter === equipe.id}
                    onClick={() => setEquipeFilter(equipe.id)}
                  >
                    {equipe.secretaria?.sigla ? `${equipe.nome} · ${equipe.secretaria.sigla}` : equipe.nome}
                  </Chip>
                ))}
                {canGerenciar && temSemEquipe ? (
                  <Chip active={equipeFilter === 'sem-equipe'} onClick={() => setEquipeFilter('sem-equipe')}>
                    Sem equipe
                  </Chip>
                ) : null}
              </div>
            ) : null}

            <div className="grid shrink-0 gap-3 xl:grid-cols-[minmax(300px,340px)_minmax(0,1fr)] xl:items-stretch">
              <section
                className={`cco-list-panel flex max-h-[min(460px,calc(100dvh-300px))] min-h-[260px] flex-col overflow-hidden rounded-[var(--r-card)] border border-[var(--line)] bg-[var(--surface)] shadow-[var(--sh-sm)] ${mobilePanel === 'lista' ? 'flex' : 'hidden xl:flex'}`}
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
