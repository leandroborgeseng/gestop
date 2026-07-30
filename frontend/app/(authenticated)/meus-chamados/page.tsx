'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Eye, Search } from 'lucide-react';
import { RequirePermissions } from '@/components/auth/require-permissions';
import { useSessionUser } from '@/components/auth/session-context';
import { ChamadoDescricaoExpandivel } from '@/components/chamados/chamado-descricao-expandivel';
import { ChamadoObservadoresSection } from '@/components/chamados/chamado-observadores-section';
import { ChamadoTimeline } from '@/components/chamados/chamado-timeline';
import { TipBanner } from '@/components/help/tip-banner';
import { PageShell } from '@/components/layout/page-shell';
import { Badge } from '@/components/ui/badge';
import { Select } from '@/components/ui/select';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui-states';
import { getMeuChamado, listMeusChamados } from '@/lib/api';
import { chamadoLocalLabel, chamadoTitulo } from '@/lib/chamado-geo';
import {
  CHAMADO_STATUS_META,
  buildChamadoTimelineFromHistorico,
  prioridadeVariant,
  prazoInfo,
} from '@/lib/chamado-status';
import { cn } from '@/lib/cn';
import { useSafeBackHref } from '@/lib/use-safe-back-href';
import { ChamadoDetalhe, ChamadoResumo } from '@/lib/types';

const PAGE_SIZE = 50;

const STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'TODOS', label: 'Todos os status' },
  ...Object.entries(CHAMADO_STATUS_META).map(([value, meta]) => ({
    value,
    label: meta.label,
  })),
];

function relacaoBadge(relacao: ChamadoResumo['relacaoComigo']) {
  if (relacao === 'ABERTO_POR_MIM') {
    return <Badge variant="brand">Aberto por mim</Badge>;
  }
  if (relacao === 'OBSERVADOR') {
    return <Badge variant="info">Observador</Badge>;
  }
  return null;
}

export default function MeusChamadosPage() {
  return (
    <Suspense fallback={<LoadingState label="Carregando meus chamados..." />}>
      <MeusChamadosPageContent />
    </Suspense>
  );
}

function MeusChamadosPageContent() {
  const searchParams = useSearchParams();
  const backHref = useSafeBackHref('/conta');
  const sessionUser = useSessionUser();
  const [items, setItems] = useState<ChamadoResumo[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState(() => searchParams.get('search') ?? '');
  const [status, setStatus] = useState('TODOS');
  const [selectedId, setSelectedId] = useState<string | null>(() => searchParams.get('id'));
  const [detail, setDetail] = useState<ChamadoDetalhe | null>(null);

  function loadList() {
    setLoading(true);
    setError(null);
    listMeusChamados({
      limit: PAGE_SIZE,
      offset: 0,
      search: search.trim() || undefined,
      status: status === 'TODOS' ? undefined : status,
    })
      .then((response) => {
        setItems(response.items);
        setTotal(response.total);
        setSelectedId((current) => current ?? response.items[0]?.id ?? null);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Falha ao carregar meus chamados.'))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    const handle = window.setTimeout(() => loadList(), 200);
    return () => window.clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- debounce search/status
  }, [search, status]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    let active = true;
    setDetailLoading(true);
    getMeuChamado(selectedId)
      .then((data) => {
        if (active) setDetail(data);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : 'Falha ao carregar detalhe.');
      })
      .finally(() => {
        if (active) setDetailLoading(false);
      });
    return () => {
      active = false;
    };
  }, [selectedId]);

  const selected = useMemo(
    () => items.find((item) => item.id === selectedId) ?? detail ?? null,
    [items, selectedId, detail],
  );

  const resumo = detail ?? selected;
  const timeline = resumo
    ? buildChamadoTimelineFromHistorico(detail?.historico ?? [], resumo.status, resumo.createdAt)
    : [];

  const canManageObservadores =
    Boolean(detail?.podeGerenciarObservadores) ||
    (Boolean(sessionUser?.id) && resumo?.registradoPor?.id === sessionUser?.id);

  async function refreshDetail() {
    if (!selectedId) return;
    const [list, nextDetail] = await Promise.all([
      listMeusChamados({
        limit: Math.max(items.length, PAGE_SIZE),
        offset: 0,
        search: search.trim() || undefined,
        status: status === 'TODOS' ? undefined : status,
      }),
      getMeuChamado(selectedId),
    ]);
    setItems(list.items);
    setTotal(list.total);
    setDetail(nextDetail);
  }

  return (
    <RequirePermissions permissions={['meus_chamados.visualizar']} match="any">
      <PageShell
        kicker="Acompanhamento"
        icon={Eye}
        title="Meus chamados"
        description="Chamados abertos por você ou em que você é observador — consulta e linha do tempo, sem acesso à triagem."
        backHref={backHref}
      >
        <TipBanner id="meus-chamados">
          Use esta tela para acompanhar o andamento dos seus chamados. Quem abriu o chamado pode adicionar
          observadores; isso não libera a tela de Chamados/CCO.
        </TipBanner>

        {error ? (
          <div className="mb-4">
            <ErrorState message={error} onRetry={loadList} />
          </div>
        ) : null}

        {loading ? <LoadingState label="Carregando meus chamados..." /> : null}

        {!loading ? (
          <div className="grid min-h-0 flex-1 gap-3.5 xl:grid-cols-[minmax(320px,388px)_1fr] xl:items-stretch">
            <section className="flex max-h-[min(360px,42vh)] min-h-[220px] flex-col overflow-hidden rounded-[var(--r-card)] border border-[var(--line)] bg-[var(--surface)] shadow-[var(--sh-sm)] xl:h-[min(720px,calc(100dvh-220px))] xl:max-h-[min(720px,calc(100dvh-220px))]">
              <div className="shrink-0 space-y-2 border-b border-[var(--line-2)] p-3.5">
                <div className="relative">
                  <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[var(--ink-3)]" />
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Buscar por código…"
                    className="h-[38px] w-full rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--surface)] pr-3 pl-9 text-[13px] focus:border-[var(--brand)] focus:outline-none focus:shadow-[0_0_0_3px_var(--brand-soft)]"
                  />
                </div>
                <Select value={status} onChange={(event) => setStatus(event.target.value)}>
                  {STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
                <p className="text-[11px] text-[var(--ink-3)]">{total} chamado{total === 1 ? '' : 's'}</p>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
                {items.length === 0 ? (
                  <EmptyState
                    title="Nenhum chamado"
                    description="Você ainda não abriu chamados e não foi adicionado como observador."
                  />
                ) : (
                  items.map((chamado) => {
                    const st = CHAMADO_STATUS_META[chamado.status] ?? {
                      label: chamado.status,
                      badge: 'muted' as const,
                    };
                    const prazo = prazoInfo(chamado.prazoEm, chamado.status);
                    const isSelected = selectedId === chamado.id;

                    return (
                      <button
                        key={chamado.id}
                        type="button"
                        onClick={() => setSelectedId(chamado.id)}
                        className={cn(
                          'mb-0.5 flex w-full flex-col gap-1.5 rounded-[var(--r-md)] border border-transparent px-3 py-2.5 text-left transition-colors',
                          isSelected
                            ? 'border-[color-mix(in_srgb,var(--brand)_30%,transparent)] bg-[var(--brand-soft)]'
                            : 'hover:bg-[var(--surface-2)]',
                        )}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="mono text-[11px] font-semibold text-[var(--brand-hover)]">
                            {chamado.codigo}
                          </span>
                          <Badge variant={prioridadeVariant(chamado.prioridade)}>{chamado.prioridade}</Badge>
                        </div>
                        <div className="flex flex-wrap gap-1.5">{relacaoBadge(chamado.relacaoComigo)}</div>
                        <p className="line-clamp-2 text-[13px] font-medium text-[var(--ink)]">
                          {chamadoTitulo(chamado)}
                        </p>
                        <div className="flex items-center justify-between gap-2 text-[11px] text-[var(--ink-3)]">
                          <span className="truncate">{chamadoLocalLabel(chamado)}</span>
                          <Badge variant={st.badge}>{st.label}</Badge>
                        </div>
                        <p className="text-[11px] text-[var(--ink-3)]">Prazo: {prazo.label}</p>
                      </button>
                    );
                  })
                )}
              </div>
            </section>

            <section className="min-h-0 overflow-y-auto rounded-[var(--r-card)] border border-[var(--line)] bg-[var(--surface)] p-4 shadow-[var(--sh-sm)] xl:h-[min(720px,calc(100dvh-220px))]">
              {!resumo ? (
                <EmptyState title="Selecione um chamado" description="Escolha um item à esquerda para ver o detalhe." />
              ) : detailLoading && !detail ? (
                <LoadingState label="Carregando detalhe..." />
              ) : (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="mono text-[12px] font-semibold text-[var(--brand-hover)]">{resumo.codigo}</p>
                      <h2 className="mt-1 text-[18px] font-semibold text-[var(--ink)]">{chamadoTitulo(resumo)}</h2>
                      <p className="mt-1 text-[13px] text-[var(--ink-3)]">{chamadoLocalLabel(resumo)}</p>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {relacaoBadge(resumo.relacaoComigo)}
                      <Badge variant={CHAMADO_STATUS_META[resumo.status]?.badge ?? 'muted'}>
                        {CHAMADO_STATUS_META[resumo.status]?.label ?? resumo.status}
                      </Badge>
                      <Badge variant={prioridadeVariant(resumo.prioridade)}>{resumo.prioridade}</Badge>
                    </div>
                  </div>

                  <ChamadoDescricaoExpandivel descricao={resumo.descricao} />

                  <div className="grid gap-2 sm:grid-cols-2">
                    <Info label="Secretaria" value={resumo.secretaria.sigla} />
                    <Info label="Tipo" value={resumo.tipoChamado?.nome ?? '—'} />
                    <Info
                      label="Aberto em"
                      value={new Date(resumo.createdAt).toLocaleString('pt-BR')}
                    />
                    <Info label="Prazo" value={prazoInfo(resumo.prazoEm, resumo.status).label} />
                    <Info label="Registrado por" value={resumo.registradoPor?.nome ?? '—'} />
                    <Info label="Equipe" value={resumo.equipe?.nome ?? '—'} />
                  </div>

                  <ChamadoObservadoresSection
                    chamado={resumo}
                    canManage={canManageObservadores}
                    mode="meus"
                    onChanged={() => void refreshDetail()}
                  />

                  <div>
                    <p className="mb-2 text-[12px] font-bold tracking-wide text-[var(--ink-2)] uppercase">
                      Linha do tempo
                    </p>
                    {detailLoading ? (
                      <LoadingState label="Carregando timeline..." />
                    ) : (
                      <ChamadoTimeline steps={timeline} />
                    )}
                  </div>
                </div>
              )}
            </section>
          </div>
        ) : null}
      </PageShell>
    </RequirePermissions>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[var(--r-md)] bg-[var(--muted-bg)] px-3 py-2">
      <p className="text-[11px] font-bold tracking-wide text-[var(--ink-3)] uppercase">{label}</p>
      <p className="mt-0.5 text-[13px] text-[var(--ink)]">{value}</p>
    </div>
  );
}
