'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Building2, ChevronDown, Clock, UserRound, UsersRound } from 'lucide-react';
import { RequirePermissions } from '@/components/auth/require-permissions';
import { PageShell } from '@/components/layout/page-shell';
import { TipBanner } from '@/components/help/tip-banner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui-states';
import { listChamadoEquipes, listChamadosEmExecucao } from '@/lib/api';
import { CHAMADO_STATUS_META, prazoInfo, prioridadeVariant } from '@/lib/chamado-status';
import { cn } from '@/lib/cn';
import { ChamadosEmExecucaoGrupo, ChamadoResumo } from '@/lib/types';

function chamadoTitulo(chamado: Pick<ChamadoResumo, 'titulo' | 'descricao'>) {
  return chamado.titulo?.trim() || chamado.descricao;
}

export default function ChamadosEmExecucaoPage() {
  return (
    <Suspense fallback={<LoadingState label="Carregando chamados em execução..." />}>
      <ChamadosEmExecucaoPageContent />
    </Suspense>
  );
}

function ChamadosEmExecucaoPageContent() {
  const searchParams = useSearchParams();
  const equipeFilter = searchParams.get('equipe');
  const [grupos, setGrupos] = useState<ChamadosEmExecucaoGrupo[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openKeys, setOpenKeys] = useState<Set<string>>(new Set());

  function load() {
    setLoading(true);
    setError(null);
    Promise.all([listChamadosEmExecucao(), listChamadoEquipes()])
      .then(([execData, equipes]) => {
        const chamadosByEquipe = new Map(
          execData.grupos.map((grupo) => [grupo.equipe?.id ?? 'sem-equipe', grupo.chamados]),
        );

        const merged: ChamadosEmExecucaoGrupo[] = equipes.map((equipe) => ({
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

        merged.sort((a, b) => {
          const nomeA = a.equipe?.nome ?? 'Sem equipe';
          const nomeB = b.equipe?.nome ?? 'Sem equipe';
          return nomeA.localeCompare(nomeB, 'pt-BR');
        });

        setGrupos(merged);
        setTotal(execData.total);

        const keys = new Set<string>();
        if (equipeFilter) keys.add(equipeFilter);
        else if (merged.length === 1) keys.add(merged[0]?.equipe?.id ?? 'sem-equipe');
        else {
          for (const grupo of merged) {
            if (grupo.chamados.length > 0) keys.add(grupo.equipe?.id ?? 'sem-equipe');
          }
        }
        setOpenKeys(keys);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Falha ao carregar chamados em execução.'))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, [equipeFilter]);

  useEffect(() => {
    if (!equipeFilter) return;
    setOpenKeys((current) => new Set([...current, equipeFilter]));
  }, [equipeFilter]);

  const filteredGrupos = useMemo(() => {
    if (!equipeFilter) return grupos;
    return grupos.filter((grupo) => (grupo.equipe?.id ?? 'sem-equipe') === equipeFilter);
  }, [grupos, equipeFilter]);

  function toggleGrupo(key: string) {
    setOpenKeys((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <RequirePermissions permissions={['chamados.gerenciar']}>
      <PageShell
        kicker="Chamados operacionais"
        icon={UsersRound}
        title="Em execução por equipe"
        description="Chamados com status Em execução, agrupados por equipe responsável. Altere o status na fila geral para movê-los para cá."
        backHref="/chamados"
        action={
          <Link href="/chamados">
            <Button variant="outlined" size="sm">
              Ver todos
            </Button>
          </Link>
        }
      >
        <TipBanner id="chamados-em-execucao">
          Para um chamado aparecer aqui, defina o status <b>Em execução</b> e, se possível, vincule uma equipe na fila de chamados.
        </TipBanner>

        {error ? (
          <div className="mb-4">
            <ErrorState message={error} onRetry={load} />
          </div>
        ) : null}

        {loading ? <LoadingState label="Carregando chamados em execução..." /> : null}

        {!loading && total === 0 && grupos.length === 0 ? (
          <EmptyState
            title="Nenhum chamado em execução"
            description="Cadastre equipes na administração e altere o status de um chamado para Em execução."
          />
        ) : null}

        {!loading && grupos.length > 0 ? (
          <div className="space-y-3">
            <p className="text-[13px] text-[var(--ink-3)]">
              {total} chamado(s) em execução
              {equipeFilter ? ' · filtro de equipe ativo' : ''}
            </p>

            {filteredGrupos.map((grupo) => {
              const key = grupo.equipe?.id ?? 'sem-equipe';
              const open = openKeys.has(key);
              const label = grupo.equipe?.nome ?? 'Sem equipe';
              const sigla = grupo.equipe?.secretaria?.sigla;

              return (
                <Card key={key} elevation={1} className="overflow-hidden">
                  <button
                    type="button"
                    onClick={() => toggleGrupo(key)}
                    className="flex w-full items-center justify-between gap-3 border-b border-[var(--line-2)] px-4 py-3 text-left hover:bg-[var(--surface-2)]"
                    aria-expanded={open}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--brand-soft)] text-[var(--brand-hover)]">
                        <UsersRound className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-[15px] font-semibold text-[var(--ink)]">{label}</p>
                        {sigla ? <p className="text-[12px] text-[var(--ink-3)]">{sigla}</p> : null}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Badge variant="warning">{grupo.chamados.length}</Badge>
                      <ChevronDown className={cn('h-5 w-5 text-[var(--ink-3)] transition-transform', open && 'rotate-180')} />
                    </div>
                  </button>

                  {open ? (
                    <CardContent className="divide-y divide-[var(--line-2)] p-0">
                      {grupo.chamados.length === 0 ? (
                        <p className="px-4 py-3 text-[13px] text-[var(--ink-3)]">Nenhum chamado em execução nesta equipe.</p>
                      ) : (
                        grupo.chamados.map((chamado) => <ChamadoExecucaoRow key={chamado.id} chamado={chamado} />)
                      )}
                    </CardContent>
                  ) : null}
                </Card>
              );
            })}
          </div>
        ) : null}
      </PageShell>
    </RequirePermissions>
  );
}

function ChamadoExecucaoRow({ chamado }: { chamado: ChamadoResumo }) {
  const st = CHAMADO_STATUS_META[chamado.status] ?? { label: chamado.status, badge: 'neutral' as const };
  const prazo = prazoInfo(chamado.prazoEm, chamado.status);

  return (
    <Link
      href={`/chamados?id=${chamado.id}`}
      className="flex flex-col gap-2 px-4 py-3 transition-colors hover:bg-[var(--surface-2)] sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="mono text-[11px] font-semibold text-[var(--brand-hover)]">{chamado.codigo}</span>
          <Badge variant={prioridadeVariant(chamado.prioridade)}>{chamado.prioridade}</Badge>
          <Badge variant={st.badge}>{st.label}</Badge>
        </div>
        <p className="mt-1 line-clamp-2 text-[14px] font-semibold text-[var(--ink)]">{chamadoTitulo(chamado)}</p>
        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-[var(--ink-3)]">
          <span className="inline-flex items-center gap-1">
            <Building2 className="h-3 w-3" />
            {chamado.unidade.nome}
          </span>
          {chamado.responsavel ? (
            <span className="inline-flex items-center gap-1">
              <UserRound className="h-3 w-3" />
              {chamado.responsavel.nome}
            </span>
          ) : null}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2 text-[12px] font-semibold text-[var(--ink-3)]">
        <Clock className="h-3.5 w-3.5" />
        {prazo.label}
      </div>
    </Link>
  );
}
