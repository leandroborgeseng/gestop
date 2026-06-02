'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  Building2,
  ClipboardList,
  Clock,
  GitBranch,
  Inbox,
  RefreshCw,
  Search,
  UserRound,
  Wrench,
} from 'lucide-react';
import { RequirePermissions } from '@/components/auth/require-permissions';
import { OsTimeline } from '@/components/ordens/os-timeline';
import { PageShell } from '@/components/layout/page-shell';
import { TipBanner } from '@/components/help/tip-banner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { Select } from '@/components/ui/select';
import { useSnackbar } from '@/components/ui/snackbar';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui-states';
import { getOrdemServico, listOrdensServico, updateOrdemServico } from '@/lib/api';
import { cn } from '@/lib/cn';
import {
  OS_STATUS_META,
  buildOsTimeline,
  nextOsStatusFlow,
  nextOsStatuses,
  osStatusLabel,
  prazoInfo,
  prioridadeVariant,
} from '@/lib/os-status';
import { OrdemServicoDetalhe, OrdemServicoResumo } from '@/lib/types';

type StatusFilter = 'TODAS' | string;
type PrioridadeFilter = 'TODAS' | string;

const STATUS_CHIPS: Array<{ value: StatusFilter; label: string }> = [
  { value: 'TODAS', label: 'Todas' },
  ...Object.entries(OS_STATUS_META).map(([value, meta]) => ({ value, label: meta.label })),
];

export default function OrdensServicoPage() {
  return (
    <Suspense fallback={<LoadingState label="Carregando ordens de serviço..." />}>
      <OrdensServicoPageContent />
    </Suspense>
  );
}

function OrdensServicoPageContent() {
  const searchParams = useSearchParams();
  const snackbar = useSnackbar();
  const [ordens, setOrdens] = useState<OrdemServicoResumo[]>([]);
  const [detail, setDetail] = useState<OrdemServicoDetalhe | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<StatusFilter>('TODAS');
  const [prioridade, setPrioridade] = useState<PrioridadeFilter>('TODAS');
  const [search, setSearch] = useState(() => searchParams.get('search') ?? '');

  useEffect(() => {
    const value = searchParams.get('search');
    if (value) setSearch(value);
  }, [searchParams]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }

    let active = true;
    setDetailLoading(true);
    getOrdemServico(selectedId)
      .then((data) => {
        if (active) setDetail(data);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : 'Falha ao carregar detalhe da OS.');
      })
      .finally(() => {
        if (active) setDetailLoading(false);
      });

    return () => {
      active = false;
    };
  }, [selectedId]);

  function load() {
    setLoading(true);
    listOrdensServico()
      .then((items) => {
        setOrdens(items);
        setSelectedId((current) => current ?? items[0]?.id ?? null);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Falha ao carregar ordens de serviço.'))
      .finally(() => setLoading(false));
  }

  const prioridades = useMemo(() => {
    const set = new Set<string>();
    for (const ordem of ordens) set.add(ordem.prioridade);
    return Array.from(set).sort();
  }, [ordens]);

  const counts = useMemo(() => {
    const next: Record<string, number> = { TODAS: ordens.length };
    for (const key of Object.keys(OS_STATUS_META)) next[key] = 0;
    for (const ordem of ordens) {
      if (next[ordem.status] != null) next[ordem.status] += 1;
    }
    return next;
  }, [ordens]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return ordens.filter((ordem) => {
      if (filter !== 'TODAS' && ordem.status !== filter) return false;
      if (prioridade !== 'TODAS' && ordem.prioridade !== prioridade) return false;
      if (!query) return true;
      const haystack = [ordem.codigo, ordem.titulo, ordem.unidade.nome, ordem.unidade.codigoPatrimonial]
        .join(' ')
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [ordens, filter, prioridade, search]);

  const selected = useMemo(() => {
    if (selectedId) {
      const match = filtered.find((item) => item.id === selectedId);
      if (match) return match;
    }
    return filtered[0] ?? null;
  }, [filtered, selectedId]);

  async function transition(id: string, status: string, codigo: string) {
    setBusyId(id);
    setError(null);
    try {
      await updateOrdemServico(id, { status, motivo: `Transição via painel para ${status}` });
      const items = await listOrdensServico();
      setOrdens(items);
      if (selectedId === id) {
        const refreshed = await getOrdemServico(id);
        setDetail(refreshed);
      }
      snackbar.show(`${codigo} → ${osStatusLabel(status)}`, 'success');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Falha ao atualizar OS.';
      setError(message);
      snackbar.show(message, 'error');
    } finally {
      setBusyId(null);
    }
  }

  async function advanceStatus(ordem: OrdemServicoResumo) {
    const next = nextOsStatusFlow(ordem.status);
    if (!next) return;
    await transition(ordem.id, next, ordem.codigo);
  }

  return (
    <RequirePermissions permissions={['chamados.gerenciar']}>
      <PageShell
        kicker="Manutenção"
        icon={Wrench}
        title="Ordens de serviço"
        description="Acompanhamento de OS com prazo, responsável e linha do tempo de execução."
        backHref="/cco"
      >
        <TipBanner id="os-lista-timeline">
          Selecione uma OS para ver prazo, responsável e linha do tempo. Use os chips para filtrar por status.
        </TipBanner>

        {error ? (
          <div className="mb-4 shrink-0">
            <ErrorState message={error} onRetry={load} />
          </div>
        ) : null}

        <div className="os-toolbar mb-4 flex shrink-0 flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="situ-chips flex flex-wrap gap-1.5">
            {STATUS_CHIPS.map((item) => (
              <Chip
                key={item.value}
                active={filter === item.value}
                count={counts[item.value] ?? 0}
                onClick={() => setFilter(item.value)}
              >
                {item.label}
              </Chip>
            ))}
          </div>
          <Select
            value={prioridade}
            onChange={(event) => setPrioridade(event.target.value)}
            className="h-9 w-full max-w-[220px] text-xs"
          >
            <option value="TODAS">Todas prioridades</option>
            {prioridades.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </Select>
        </div>

        {loading ? <LoadingState label="Carregando ordens de serviço..." /> : null}

        {!loading ? (
          <div className="grid min-h-0 flex-1 gap-3.5 xl:grid-cols-[minmax(320px,388px)_1fr]">
            <section className="flex min-h-[420px] flex-col overflow-hidden rounded-[var(--r-card)] border border-[var(--line)] bg-[var(--surface)] shadow-[var(--sh-sm)] xl:min-h-[520px]">
              <div className="shrink-0 border-b border-[var(--line-2)] p-3.5">
                <div className="relative">
                  <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[var(--ink-3)]" />
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Buscar OS, unidade…"
                    className="h-[38px] w-full rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--surface)] pr-3 pl-9 text-[13px] focus:border-[var(--brand)] focus:outline-none focus:shadow-[0_0_0_3px_var(--brand-soft)]"
                  />
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
                {filtered.length === 0 ? (
                  <EmptyState title="Nenhuma ordem de serviço" description="Nenhuma OS neste filtro." />
                ) : (
                  filtered.map((ordem) => {
                    const st = OS_STATUS_META[ordem.status] ?? { label: ordem.status, badge: 'neutral' as const };
                    const prazo = prazoInfo(ordem.prazoEm, ordem.status);
                    const isSelected = selected?.id === ordem.id;

                    return (
                      <button
                        key={ordem.id}
                        type="button"
                        onClick={() => setSelectedId(ordem.id)}
                        className={cn(
                          'mb-0.5 flex w-full flex-col gap-1.5 rounded-[var(--r-md)] border border-transparent px-3 py-2.5 text-left transition-colors',
                          isSelected
                            ? 'border-[color-mix(in_srgb,var(--brand)_30%,transparent)] bg-[var(--brand-soft)]'
                            : 'hover:bg-[var(--surface-2)]',
                        )}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="mono text-[11px] font-semibold text-[var(--brand-hover)]">{ordem.codigo}</span>
                          <Badge variant={prioridadeVariant(ordem.prioridade)}>{ordem.prioridade}</Badge>
                        </div>
                        <p className="line-clamp-2 text-[13px] font-semibold text-[var(--ink)]">{ordem.titulo}</p>
                        <p className="truncate text-[12px] text-[var(--ink-3)]">{ordem.unidade.nome}</p>
                        <div className="flex flex-wrap items-center gap-2 pt-0.5">
                          <Badge variant={st.badge}>{st.label}</Badge>
                          <span
                            className={cn(
                              'inline-flex items-center gap-1 text-[11px] font-semibold',
                              prazo.tone === 'danger' && 'text-[var(--danger)]',
                              prazo.tone === 'warning' && 'text-[var(--warn)]',
                              prazo.tone === 'neutral' && 'text-[var(--ink-3)]',
                              prazo.tone === 'success' && 'text-[var(--ok)]',
                            )}
                          >
                            <Clock className="h-3 w-3" />
                            {prazo.label}
                          </span>
                          {ordem.responsavel ? (
                            <span className="inline-flex items-center gap-1 text-[11px] text-[var(--ink-3)]">
                              <UserRound className="h-3 w-3" />
                              {ordem.responsavel.nome}
                            </span>
                          ) : null}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </section>

            <section className="min-h-[320px]">
              <OsDetailPanel
                resumo={selected}
                detail={detail?.id === selected?.id ? detail : null}
                loading={detailLoading && !!selected}
                busy={busyId === selected?.id}
                onTransition={transition}
                onAdvance={advanceStatus}
              />
            </section>
          </div>
        ) : null}
      </PageShell>
    </RequirePermissions>
  );
}

function OsDetailPanel({
  resumo,
  detail,
  loading,
  busy,
  onTransition,
  onAdvance,
}: {
  resumo: OrdemServicoResumo | null;
  detail: OrdemServicoDetalhe | null;
  loading: boolean;
  busy: boolean;
  onTransition: (id: string, status: string, codigo: string) => void;
  onAdvance: (ordem: OrdemServicoResumo) => void;
}) {
  if (!resumo) {
    return (
      <Card elevation={1} className="flex h-full min-h-[320px] flex-col items-center justify-center text-center">
        <CardContent className="flex flex-col items-center gap-2 p-8">
          <Inbox className="h-8 w-8 text-[var(--ink-3)]" />
          <p className="text-[15px] font-semibold text-[var(--ink)]">Selecione uma OS</p>
          <p className="max-w-xs text-[13px] text-[var(--ink-3)]">Escolha um item da lista para ver prazo, responsável e timeline.</p>
        </CardContent>
      </Card>
    );
  }

  const st = OS_STATUS_META[resumo.status] ?? { label: resumo.status, badge: 'neutral' as const };
  const prazo = prazoInfo(resumo.prazoEm, resumo.status);
  const canAct = resumo.status !== 'CONCLUIDA' && resumo.status !== 'CANCELADA';
  const timeline = buildOsTimeline(
    resumo.status,
    resumo.abertaEm,
    resumo.prazoEm,
    detail?.concluidaEm,
    resumo.responsavel?.nome,
    resumo.prioridade,
    resumo.origem,
  );

  return (
    <Card elevation={1} className="h-full overflow-hidden">
      <CardContent className="flex h-full flex-col p-0">
        <div className="border-b border-[var(--line-2)] p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <span className="mono text-[13px] font-semibold text-[var(--brand-hover)]">{resumo.codigo}</span>
            <div className="flex flex-wrap gap-1.5">
              <Badge variant={prioridadeVariant(resumo.prioridade)}>{resumo.prioridade}</Badge>
              <Badge variant={st.badge}>{st.label}</Badge>
            </div>
          </div>
          <h2 className="mt-3 text-[17px] font-semibold leading-snug text-[var(--ink)]">{resumo.titulo}</h2>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-[var(--ink-3)]">
            <span className="inline-flex items-center gap-1.5">
              <Building2 className="h-3.5 w-3.5" />
              {resumo.unidade.nome}
            </span>
            <span className="mono">{resumo.unidade.codigoPatrimonial}</span>
          </div>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto p-5">
          <div className="grid gap-3 sm:grid-cols-3">
            <SummaryCard
              label="Prazo"
              value={prazo.label}
              sub={resumo.prazoEm ? new Date(resumo.prazoEm).toLocaleDateString('pt-BR') : undefined}
              tone={prazo.tone}
            />
            <SummaryCard
              label="Responsável"
              value={resumo.responsavel?.nome ?? 'Não atribuído'}
              sub={resumo.secretaria.sigla}
            />
            <SummaryCard label="Origem" value={resumo.origem} />
          </div>

          {resumo.naoConformidade ? (
            <div className="rounded-[var(--r-md)] border border-[var(--brand-soft)] bg-[var(--brand-soft)] p-4">
              <p className="flex items-center gap-2 text-[12px] font-bold text-[var(--brand-hover)]">
                <GitBranch className="h-4 w-4" />
                Origem auditável (NC)
              </p>
              <p className="mt-2 text-[13px] text-[var(--ink-2)]">
                {resumo.naoConformidade.item.codigo} — {resumo.naoConformidade.item.titulo}
              </p>
              <p className="mt-1 text-[12px] text-[var(--ink-3)]">{resumo.naoConformidade.descricao}</p>
            </div>
          ) : null}

          <div>
            <p className="mb-3 text-[11px] font-bold tracking-wide text-[var(--ink-3)] uppercase">Linha do tempo</p>
            {loading ? (
              <LoadingState label="Carregando timeline..." />
            ) : (
              <OsTimeline steps={timeline} />
            )}
          </div>

          {canAct ? (
            <div className="flex flex-wrap gap-2 border-t border-[var(--line-2)] pt-4">
              {nextOsStatusFlow(resumo.status) ? (
                <Button variant="filled" size="sm" disabled={busy} onClick={() => onAdvance(resumo)}>
                  <RefreshCw className="h-4 w-4" />
                  Atualizar status
                </Button>
              ) : null}
              {nextOsStatuses(resumo.status).includes('CONCLUIDA') ? (
                <Button
                  variant="outlined"
                  size="sm"
                  disabled={busy}
                  onClick={() => onTransition(resumo.id, 'CONCLUIDA', resumo.codigo)}
                >
                  Concluir OS
                </Button>
              ) : null}
              {nextOsStatuses(resumo.status)
                .filter((status) => status !== 'CONCLUIDA')
                .map((status) => (
                  <Button
                    key={status}
                    variant="tonal"
                    size="sm"
                    disabled={busy}
                    onClick={() => onTransition(resumo.id, status, resumo.codigo)}
                  >
                    {osStatusLabel(status)}
                  </Button>
                ))}
              <Link
                href={`/ordens-servico/${resumo.id}`}
                className="inline-flex h-9 items-center gap-1.5 rounded-[var(--r-pill)] px-3 text-[12px] font-semibold text-[var(--brand-hover)] hover:bg-[var(--brand-soft)]"
              >
                <ClipboardList className="h-4 w-4" />
                Ver detalhe completo
              </Link>
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

function SummaryCard({
  label,
  value,
  sub,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: 'neutral' | 'success' | 'warning' | 'danger';
}) {
  const toneClass =
    tone === 'danger'
      ? 'border-[var(--danger-bd)] bg-[var(--danger-bg)]'
      : tone === 'warning'
        ? 'border-[var(--warn-bd)] bg-[var(--warn-bg)]'
        : tone === 'success'
          ? 'border-[var(--ok-bd)] bg-[var(--ok-bg)]'
          : 'border-[var(--line)] bg-[var(--surface-2)]';

  return (
    <div className={cn('rounded-[var(--r-md)] border p-3', toneClass)}>
      <p className="text-[10px] font-bold tracking-wide text-[var(--ink-3)] uppercase">{label}</p>
      <p className="mt-1 text-[14px] font-semibold text-[var(--ink)]">{value}</p>
      {sub ? <p className="mono mt-0.5 text-[11px] text-[var(--ink-3)]">{sub}</p> : null}
    </div>
  );
}
