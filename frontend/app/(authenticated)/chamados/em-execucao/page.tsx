'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { MapPinned, Search, UsersRound } from 'lucide-react';
import { RequirePermissions } from '@/components/auth/require-permissions';
import { ChamadosExecucaoList } from '@/components/chamados/chamados-execucao-list';
import { ChamadosExecucaoMap } from '@/components/chamados/chamados-execucao-map';
import { PageShell } from '@/components/layout/page-shell';
import { TipBanner } from '@/components/help/tip-banner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui-states';
import { chamadoToMapPoint } from '@/lib/chamado-geo';
import { listChamadoEquipes, listChamadosEmExecucao } from '@/lib/api';
import { ChamadosEmExecucaoGrupo } from '@/lib/types';

export default function ChamadosEmExecucaoPage() {
  return (
    <Suspense fallback={<LoadingState label="Carregando chamados em execução..." />}>
      <ChamadosEmExecucaoPageContent />
    </Suspense>
  );
}

function ChamadosEmExecucaoPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const equipeFilter = searchParams.get('equipe');
  const [grupos, setGrupos] = useState<ChamadosEmExecucaoGrupo[]>([]);
  const [total, setTotal] = useState(0);
  const [equipes, setEquipes] = useState<Array<{ id: string; nome: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  function load() {
    setLoading(true);
    setError(null);
    Promise.all([listChamadosEmExecucao(), listChamadoEquipes()])
      .then(([execData, equipesData]) => {
        const chamadosByEquipe = new Map(
          execData.grupos.map((grupo) => [grupo.equipe?.id ?? 'sem-equipe', grupo.chamados]),
        );

        const merged: ChamadosEmExecucaoGrupo[] = equipesData.map((equipe) => ({
          equipe: {
            id: equipe.id,
            nome: equipe.nome,
            secretaria: equipe.secretaria ? { sigla: equipe.secretaria.sigla } : null,
          },
          chamados: chamadosByEquipe.get(equipe.id) ?? [],
        }));

        const semEquipeChamados = chamadosByEquipe.get('sem-equipe');
        if (semEquipeChamados?.length) {
          merged.push({ equipe: null, chamados: semEquipeChamados });
        }

        setGrupos(merged);
        setTotal(execData.total);
        setEquipes(equipesData.map((equipe) => ({ id: equipe.id, nome: equipe.nome })));
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Falha ao carregar chamados em execução.'))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, [equipeFilter]);

  const chamados = useMemo(() => {
    let items = grupos.flatMap((grupo) => grupo.chamados);
    if (equipeFilter) {
      items = items.filter((chamado) => (chamado.equipe?.id ?? 'sem-equipe') === equipeFilter);
    }
    const query = search.trim().toLowerCase();
    if (!query) return items;
    return items.filter((chamado) =>
      `${chamado.codigo} ${chamado.titulo ?? ''} ${chamado.descricao} ${chamado.unidade.nome} ${chamado.equipe?.nome ?? ''}`
        .toLowerCase()
        .includes(query),
    );
  }, [grupos, equipeFilter, search]);

  const mapPoints = useMemo(
    () => chamados.map((chamado) => chamadoToMapPoint(chamado)).filter((item): item is NonNullable<typeof item> => Boolean(item)),
    [chamados],
  );

  const openExecucao = useCallback(
    (id: string) => {
      setSelectedId(id);
      router.push(`/chamados/em-execucao/${id}`);
    },
    [router],
  );

  const equipeLabel = equipeFilter
    ? equipes.find((equipe) => equipe.id === equipeFilter)?.nome ?? (equipeFilter === 'sem-equipe' ? 'Sem equipe' : 'Equipe')
    : null;

  return (
    <RequirePermissions permissions={['chamados.gerenciar']}>
      <PageShell
        kicker="Chamados operacionais"
        icon={UsersRound}
        title="Em execução — mapa e fila de campo"
        description="Visualize todos os chamados em execução no mapa e na lista. Selecione um chamado para iniciar o fluxo de execução com check-in GPS e evidências."
        backHref="/chamados"
        className="min-h-0"
        action={
          <Link href="/chamados">
            <Button variant="outlined" size="sm">
              Ver todos
            </Button>
          </Link>
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

        {!loading && total === 0 && grupos.length === 0 ? (
          <EmptyState
            title="Nenhum chamado em execução"
            description="Cadastre equipes, atribua ao chamado e altere o status para Em execução."
          />
        ) : null}

        {!loading && (total > 0 || grupos.length > 0) ? (
          <>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Badge variant="warning">{total} em execução</Badge>
              <Badge variant="neutral">{mapPoints.length} no mapa</Badge>
              {equipeLabel ? <Badge variant="brand">{equipeLabel}</Badge> : null}
            </div>

            <div className="mb-3 flex flex-wrap gap-2">
              <Chip active={!equipeFilter} onClick={() => router.push('/chamados/em-execucao')}>
                Todas equipes
              </Chip>
              {equipes.map((equipe) => (
                <Chip
                  key={equipe.id}
                  active={equipeFilter === equipe.id}
                  onClick={() => router.push(`/chamados/em-execucao?equipe=${equipe.id}`)}
                >
                  {equipe.nome}
                </Chip>
              ))}
            </div>

            <div className="grid shrink-0 gap-3 xl:grid-cols-[minmax(300px,340px)_minmax(0,1fr)] xl:items-stretch">
              <section className="cco-list-panel flex max-h-[min(460px,calc(100dvh-300px))] min-h-[260px] flex-col overflow-hidden rounded-[var(--r-card)] border border-[var(--line)] bg-[var(--surface)] shadow-[var(--sh-sm)]">
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

              <section className="cco-map-panel min-h-[240px]">
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
