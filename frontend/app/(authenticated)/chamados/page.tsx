'use client';

import Link from 'next/link';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  CalendarDays,
  Bell,
  Building2,
  ClipboardList,
  Clock,
  Crosshair,
  FileDown,
  GitBranch,
  Inbox,
  Megaphone,
  Search,
  Smartphone,
  UserRound,
} from 'lucide-react';
import { RequirePermissions } from '@/components/auth/require-permissions';
import { ChamadoTimeline } from '@/components/chamados/chamado-timeline';
import { ChamadoHistoricoForm } from '@/components/chamados/chamado-historico-form';
import { ChamadoAberturaSection } from '@/components/chamados/chamado-abertura-section';
import { ChamadoDescricaoExpandivel } from '@/components/chamados/chamado-descricao-expandivel';
import { ChamadosFiltrosPanel, ChamadosFiltrosValue } from '@/components/chamados/chamados-filtros-panel';
import { ChamadosProgramacaoPanel } from '@/components/chamados/chamados-programacao-panel';
import { ZoomableAuthenticatedImage } from '@/components/ui/zoomable-authenticated-image';
import { PageShell } from '@/components/layout/page-shell';
import { TipBanner } from '@/components/help/tip-banner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { Select } from '@/components/ui/select';
import { useSnackbar } from '@/components/ui/snackbar';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui-states';
import { downloadChamadoPdf, getChamado, listChamadoEquipes, listChamados, listTiposChamadoOpcoes, notificarChamadoEquipe, updateChamadoAtribuicao, updateChamadoPlanejamento, updateChamadoStatus, updateChamadoTriagem } from '@/lib/api';
import { cn } from '@/lib/cn';
import { chamadoLocalLabel, chamadoTitulo } from '@/lib/chamado-geo';
import {
  chamadoMatchesFiltros,
  collectSecretariasFromChamados,
  countChamadosByStatus,
} from '@/lib/chamado-filtros';
import { toInputDate } from '@/lib/cronograma';
import { useSafeBackHref } from '@/lib/use-safe-back-href';
import { useSessionUser } from '@/components/auth/session-context';
import {
  CHAMADO_STATUS_META,
  buildChamadoTimelineFromHistorico,
  chamadoStatusLabel,
  prazoInfo,
  previstaExecucaoInfo,
  prioridadeVariant,
} from '@/lib/chamado-status';
import { ChamadoDetalhe, ChamadoOrigem, ChamadoResumo, ChamadoStatus, EquipeOpcao, TipoChamadoOpcao } from '@/lib/types';

type ChamadosView = 'triagem' | 'programacao';

const TRIAGEM_PRIORIDADES = ['BAIXA', 'MEDIA', 'ALTA', 'URGENTE'] as const;

const CHAMADOS_PAGE_SIZE = 50;

const DEFAULT_FILTROS: ChamadosFiltrosValue = {
  statuses: 'TODOS',
  prioridade: 'TODAS',
  sla: 'TODOS',
  atribuicao: 'TODOS',
  equipeId: '',
  secretariaProprioId: '',
  secretariaExecucaoId: '',
  tipoChamadoId: '',
};

function origemMeta(origem: ChamadoOrigem) {
  switch (origem) {
    case 'QR_CODE':
      return { label: 'QR Code', icon: Crosshair };
    case 'INTERNO':
      return { label: 'App interno', icon: Smartphone };
    case 'FISCALIZACAO':
      return { label: 'Vistoria', icon: ClipboardList };
    default:
      return { label: 'Manual', icon: Bell };
  }
}

export default function ChamadosPage() {
  return (
    <Suspense fallback={<LoadingState label="Carregando chamados..." />}>
      <ChamadosPageContent />
    </Suspense>
  );
}

function ChamadosPageContent() {
  const searchParams = useSearchParams();
  const backHref = useSafeBackHref('/cco');
  const snackbar = useSnackbar();
  const sessionUser = useSessionUser();
  const [chamados, setChamados] = useState<ChamadoResumo[]>([]);
  const [chamadosTotal, setChamadosTotal] = useState(0);
  const [hasMoreChamados, setHasMoreChamados] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [equipes, setEquipes] = useState<EquipeOpcao[]>([]);
  const [tiposChamado, setTiposChamado] = useState<TipoChamadoOpcao[]>([]);
  const [detail, setDetail] = useState<ChamadoDetalhe | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filtros, setFiltros] = useState<ChamadosFiltrosValue>(DEFAULT_FILTROS);
  const [view, setView] = useState<ChamadosView>('triagem');
  const [search, setSearch] = useState(() => searchParams.get('search') ?? '');

  useEffect(() => {
    const value = searchParams.get('search');
    if (value) setSearch(value);
  }, [searchParams]);

  const [selectedId, setSelectedId] = useState<string | null>(() => searchParams.get('id'));
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    const id = searchParams.get('id');
    if (id) setSelectedId(id);
  }, [searchParams]);

  useEffect(() => {
    listChamadoEquipes()
      .then(setEquipes)
      .catch((err) => setError(err instanceof Error ? err.message : 'Falha ao carregar equipes.'));
    listTiposChamadoOpcoes()
      .then(setTiposChamado)
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (view !== 'triagem') return;

    setLoading(true);
    listChamados({ limit: CHAMADOS_PAGE_SIZE, offset: 0 })
      .then((response) => {
        setChamados(response.items);
        setChamadosTotal(response.total);
        setHasMoreChamados(response.hasMore);
        setSelectedId((current) => current ?? response.items[0]?.id ?? null);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Falha ao carregar chamados.'))
      .finally(() => setLoading(false));
  }, [view]);

  async function refreshChamadosList() {
    const limit = Math.max(chamados.length, CHAMADOS_PAGE_SIZE);
    const response = await listChamados({ limit, offset: 0 });
    setChamados(response.items);
    setChamadosTotal(response.total);
    setHasMoreChamados(response.hasMore);
    return response;
  }

  async function loadMoreChamados() {
    setLoadingMore(true);
    setError(null);
    try {
      const response = await listChamados({ limit: CHAMADOS_PAGE_SIZE, offset: chamados.length });
      setChamados((current) => [...current, ...response.items]);
      setChamadosTotal(response.total);
      setHasMoreChamados(response.hasMore);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar mais chamados.');
    } finally {
      setLoadingMore(false);
    }
  }

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }

    let active = true;
    setDetailLoading(true);
    getChamado(selectedId)
      .then((data) => {
        if (active) setDetail(data);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : 'Falha ao carregar detalhe do chamado.');
      })
      .finally(() => {
        if (active) setDetailLoading(false);
      });

    return () => {
      active = false;
    };
  }, [selectedId]);

  function load() {
    if (view !== 'triagem') return;
    setLoading(true);
    listChamados({ limit: CHAMADOS_PAGE_SIZE, offset: 0 })
      .then((response) => {
        setChamados(response.items);
        setChamadosTotal(response.total);
        setHasMoreChamados(response.hasMore);
        setSelectedId((current) => current ?? response.items[0]?.id ?? null);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Falha ao carregar chamados.'))
      .finally(() => setLoading(false));
  }

  const secretariasDisponiveis = useMemo(() => collectSecretariasFromChamados(chamados), [chamados]);

  const showSemSla = useMemo(() => chamados.some((item) => !item.prazoEm), [chamados]);

  const minhaEquipeIds = useMemo(() => {
    const userId = sessionUser?.id;
    if (!userId) return new Set<string>();
    return new Set(
      equipes
        .filter((equipe) => equipe.membros?.some((membro) => membro.usuario.id === userId))
        .map((equipe) => equipe.id),
    );
  }, [equipes, sessionUser?.id]);

  const filtroMatchOpts = useMemo(
    () => ({
      statuses: filtros.statuses,
      prioridade: filtros.prioridade,
      sla: filtros.sla,
      atribuicao: filtros.atribuicao,
      equipeId: filtros.equipeId,
      secretariaProprioId: filtros.secretariaProprioId,
      secretariaExecucaoId: filtros.secretariaExecucaoId,
      tipoChamadoId: filtros.tipoChamadoId,
      search,
      userId: sessionUser?.id,
      minhaEquipeIds,
    }),
    [filtros, minhaEquipeIds, search, sessionUser?.id],
  );

  const counts = useMemo(() => {
    return countChamadosByStatus(chamados, filtroMatchOpts);
  }, [chamados, filtroMatchOpts]);

  const filtered = useMemo(() => {
    return chamados.filter((item) => chamadoMatchesFiltros(item, filtroMatchOpts));
  }, [chamados, filtroMatchOpts]);

  const selected = useMemo(() => {
    if (selectedId) {
      const match = filtered.find((item) => item.id === selectedId);
      if (match) return match;
      const anyMatch = chamados.find((item) => item.id === selectedId);
      if (anyMatch) return anyMatch;
    }
    return filtered[0] ?? null;
  }, [filtered, selectedId, chamados]);

  async function assignTeam(
    id: string,
    codigo: string,
    equipeId: string,
    responsavelId: string,
    motivo?: string,
  ) {
    setBusyId(id);
    setError(null);
    try {
      await updateChamadoAtribuicao(id, {
        equipeId,
        responsavelId: responsavelId || null,
        motivo: motivo?.trim() || 'Atribuição de equipe/responsável atualizada.',
      });
      await refreshChamadosList();
      if (selectedId === id) {
        const refreshed = await getChamado(id);
        setDetail(refreshed);
      }
      snackbar.show(`${codigo}: equipe atualizada`, 'success');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Falha ao atribuir equipe.';
      setError(message);
      snackbar.show(message, 'error');
    } finally {
      setBusyId(null);
    }
  }

  async function savePlanejamento(
    id: string,
    codigo: string,
    previstaExecucaoEm: string | null,
    equipeId?: string | null,
  ) {
    setBusyId(id);
    setError(null);
    try {
      await updateChamadoPlanejamento(id, {
        previstaExecucaoEm,
        ...(equipeId !== undefined ? { equipeId } : {}),
      });
      await refreshChamadosList();
      if (selectedId === id) {
        const refreshed = await getChamado(id);
        setDetail(refreshed);
      }
      snackbar.show(`${codigo}: data prevista atualizada`, 'success');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Falha ao salvar data prevista.';
      setError(message);
      snackbar.show(message, 'error');
    } finally {
      setBusyId(null);
    }
  }

  async function transition(
    id: string,
    status: ChamadoStatus,
    codigo: string,
    motivo?: string,
    impedimentoMotivo?: string,
  ) {
    setBusyId(id);
    setError(null);
    try {
      await updateChamadoStatus(id, {
        status,
        motivo: motivo?.trim() || `Status alterado para ${chamadoStatusLabel(status)}`,
        impedimentoMotivo,
      });
      await refreshChamadosList();
      if (selectedId === id) {
        const refreshed = await getChamado(id);
        setDetail(refreshed);
      }
      snackbar.show(`${codigo} → ${chamadoStatusLabel(status)}`, 'success');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Falha ao atualizar chamado.';
      setError(message);
      snackbar.show(message, 'error');
    } finally {
      setBusyId(null);
    }
  }

  async function saveTriagem(
    id: string,
    codigo: string,
    payload: { tipoChamadoId: string | null; prioridade: (typeof TRIAGEM_PRIORIDADES)[number]; motivoAlteracao?: string },
  ) {
    setBusyId(id);
    setError(null);
    try {
      const updated = await updateChamadoTriagem(id, payload);
      setChamados((current) => current.map((item) => (item.id === id ? { ...item, ...updated } : item)));
      if (selectedId === id) {
        const refreshed = await getChamado(id);
        setDetail(refreshed);
      }
      snackbar.show(`${codigo}: triagem atualizada e SLA recalculado`, 'success');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Falha ao salvar triagem.';
      setError(message);
      snackbar.show(message, 'error');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <RequirePermissions permissions={['chamados.gerenciar']}>
      <PageShell
        kicker="Atendimento operacional"
        icon={Megaphone}
        title="Chamados"
        description="Triagem, atendimento e acompanhamento — abertos via QR Code, vistoria, app de vistoria e registro interno."
        backHref={backHref}
        action={
          <Link href="/chamados/novo">
            <Button variant="filled" size="md" className="gap-1.5">
              <Bell className="h-4 w-4" />
              Abrir chamado
            </Button>
          </Link>
        }
      >
        <TipBanner id="chamados-triagem">
          {view === 'triagem'
            ? 'Selecione um chamado na lista para ver prazo, responsável e linha do tempo. Use a lista de status para alterar ou voltar etapas — cada mudança fica registrada no histórico.'
            : 'Programe chamados para datas futuras e defina a equipe de execução. Clique em um dia no calendário para ver ou ajustar a fila programada.'}
        </TipBanner>

        <div className="mb-4 flex flex-wrap gap-2">
          <Chip active={view === 'triagem'} onClick={() => setView('triagem')}>
            Triagem
          </Chip>
          <Chip active={view === 'programacao'} onClick={() => setView('programacao')}>
            Programação
          </Chip>
        </div>

        {view === 'programacao' ? (
          <ChamadosProgramacaoPanel equipes={equipes} tiposChamado={tiposChamado} />
        ) : null}

        {view === 'triagem' && chamadosTotal > 0 ? (
          <p className="mb-3 text-[12px] text-[var(--ink-3)]">
            Exibindo {filtered.length} de {chamadosTotal} chamados
            {hasMoreChamados ? ' — carregue mais para ver a lista completa' : ''}.
          </p>
        ) : null}

        {view === 'triagem' && hasMoreChamados ? (
          <div className="mb-4">
            <Button type="button" variant="outlined" size="sm" disabled={loadingMore} onClick={() => void loadMoreChamados()}>
              {loadingMore ? 'Carregando...' : `Carregar mais (${CHAMADOS_PAGE_SIZE})`}
            </Button>
          </div>
        ) : null}

        {view === 'triagem' && error ? (
          <div className="mb-4 shrink-0">
            <ErrorState message={error} onRetry={load} />
          </div>
        ) : null}

        {view === 'triagem' ? (
          <div className="mb-4 shrink-0">
            <ChamadosFiltrosPanel
              value={filtros}
              onChange={setFiltros}
              statusCounts={counts}
              equipes={equipes}
              tiposChamado={tiposChamado}
              secretariasProprio={secretariasDisponiveis.proprio}
              secretariasExecucao={secretariasDisponiveis.execucao}
              showSemSla={showSemSla}
            />
          </div>
        ) : null}

        {view === 'triagem' && loading ? <LoadingState label="Carregando chamados..." /> : null}

        {view === 'triagem' && !loading ? (
          <div className="grid min-h-0 flex-1 gap-3.5 xl:grid-cols-[minmax(320px,388px)_1fr] xl:items-stretch">
            <section className="flex max-h-[min(360px,42vh)] min-h-[220px] flex-col overflow-hidden rounded-[var(--r-card)] border border-[var(--line)] bg-[var(--surface)] shadow-[var(--sh-sm)] xl:h-[min(720px,calc(100dvh-220px))] xl:max-h-[min(720px,calc(100dvh-220px))]">
              <div className="shrink-0 border-b border-[var(--line-2)] p-3.5">
                <div className="relative">
                  <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[var(--ink-3)]" />
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Buscar por código, descrição ou unidade…"
                    className="h-[38px] w-full rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--surface)] pr-3 pl-9 text-[13px] focus:border-[var(--brand)] focus:outline-none focus:shadow-[0_0_0_3px_var(--brand-soft)]"
                  />
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
                {filtered.length === 0 ? (
                  <EmptyState
                    title="Nenhum chamado"
                    description={
                      filtros.statuses === 'TODOS'
                        ? 'Nenhum chamado registrado ainda.'
                        : 'Nenhum chamado neste filtro.'
                    }
                  />
                ) : (
                  filtered.map((chamado) => {
                    const st = CHAMADO_STATUS_META[chamado.status] ?? { label: chamado.status, badge: 'neutral' as const };
                    const canal = origemMeta(chamado.origem);
                    const CanalIcon = canal.icon;
                    const prazo = prazoInfo(chamado.prazoEm, chamado.status);
                    const prevista = previstaExecucaoInfo(chamado.previstaExecucaoEm, chamado.status);
                    const isSelected = selected?.id === chamado.id;

                    return (
                      <button
                        key={chamado.id}
                        type="button"
                        onClick={() => setSelectedId(chamado.id)}
                        className={cn(
                          'ch-row mb-0.5 flex w-full flex-col gap-1.5 rounded-[var(--r-md)] border border-transparent px-3 py-2.5 text-left transition-colors',
                          isSelected
                            ? 'border-[color-mix(in_srgb,var(--brand)_30%,transparent)] bg-[var(--brand-soft)]'
                            : 'hover:bg-[var(--surface-2)]',
                        )}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="mono text-[11px] font-semibold text-[var(--brand-hover)]">{chamado.codigo}</span>
                          <Badge variant={prioridadeVariant(chamado.prioridade)}>{chamado.prioridade}</Badge>
                        </div>
                        <p className="line-clamp-2 text-[13px] font-semibold text-[var(--ink)]">{chamadoTitulo(chamado)}</p>
                        <p className="truncate text-[12px] text-[var(--ink-3)]">{chamadoLocalLabel(chamado)}</p>
                        <div className="flex flex-wrap items-center gap-2 pt-0.5">
                          <Badge variant={st.badge}>{st.label}</Badge>
                          <span
                            className={cn(
                              'inline-flex items-center gap-1 text-[11px] font-semibold',
                              prevista.tone === 'danger' && 'text-[var(--danger)]',
                              prevista.tone === 'warning' && 'text-[var(--warn)]',
                              prevista.tone === 'brand' && 'text-[var(--brand)]',
                              prevista.tone === 'neutral' && 'text-[var(--ink-3)]',
                            )}
                          >
                            <CalendarDays className="h-3 w-3" />
                            {prevista.label}
                          </span>
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
                            <span className="flex flex-col leading-tight">
                              <span>{prazo.value}</span>
                              {prazo.sub ? <span className="font-normal opacity-80">{prazo.sub}</span> : null}
                            </span>
                          </span>
                          <span className="inline-flex items-center gap-1 text-[11px] text-[var(--ink-3)]">
                            <CanalIcon className="h-3 w-3" />
                            {canal.label}
                          </span>
                          {chamado.equipe ? (
                            <span className="inline-flex items-center gap-1 text-[11px] text-[var(--ink-3)]">
                              <UserRound className="h-3 w-3" />
                              {chamado.equipe.nome}
                            </span>
                          ) : null}
                          {chamado.responsavel ? (
                            <span className="inline-flex items-center gap-1 text-[11px] text-[var(--ink-3)]">
                              <UserRound className="h-3 w-3" />
                              {chamado.responsavel.nome}
                            </span>
                          ) : null}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </section>

            <section className="min-h-[320px] overflow-hidden xl:h-[min(720px,calc(100dvh-220px))] xl:overflow-y-auto">
              <ChamadoDetailPanel
                resumo={selected}
                detail={detail?.id === selected?.id ? detail : null}
                equipes={equipes}
                tiposChamado={tiposChamado}
                loading={detailLoading && !!selected}
                busy={busyId === selected?.id}
                onTransition={transition}
                onAssignTeam={assignTeam}
                onSavePlanejamento={savePlanejamento}
                onSaveTriagem={saveTriagem}
                onRefreshDetail={() => {
                  if (!selected?.id) return;
                  getChamado(selected.id)
                    .then((refreshed) => {
                      setDetail(refreshed);
                      setChamados((current) => current.map((item) => (item.id === refreshed.id ? { ...item, ...refreshed } : item)));
                    })
                    .catch(() => undefined);
                }}
              />
            </section>
          </div>
        ) : null}
      </PageShell>
    </RequirePermissions>
  );
}

function ChamadoDetailPanel({
  resumo,
  detail,
  equipes,
  tiposChamado,
  loading,
  busy,
  onTransition,
  onAssignTeam,
  onSavePlanejamento,
  onSaveTriagem,
  onRefreshDetail,
}: {
  resumo: ChamadoResumo | null;
  detail: ChamadoDetalhe | null;
  equipes: EquipeOpcao[];
  tiposChamado: TipoChamadoOpcao[];
  loading: boolean;
  busy: boolean;
  onTransition: (
    id: string,
    status: ChamadoStatus,
    codigo: string,
    motivo?: string,
    impedimentoMotivo?: string,
  ) => void;
  onAssignTeam: (id: string, codigo: string, equipeId: string, responsavelId: string, motivo?: string) => void;
  onSavePlanejamento: (id: string, codigo: string, previstaExecucaoEm: string | null, equipeId?: string | null) => void;
  onSaveTriagem: (
    id: string,
    codigo: string,
    payload: { tipoChamadoId: string | null; prioridade: (typeof TRIAGEM_PRIORIDADES)[number]; motivoAlteracao?: string },
  ) => void;
  onRefreshDetail: () => void;
}) {
  const snackbar = useSnackbar();
  const [pendingStatus, setPendingStatus] = useState<ChamadoStatus>('ABERTO');
  const [pdfBusy, setPdfBusy] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [impedimentoMotivo, setImpedimentoMotivo] = useState('');
  const [pendingEquipePlanejamentoId, setPendingEquipePlanejamentoId] = useState('');
  const [pendingEquipeAtribuicaoId, setPendingEquipeAtribuicaoId] = useState('');
  const [pendingResponsavelId, setPendingResponsavelId] = useState('');
  const [atribuicaoMotivo, setAtribuicaoMotivo] = useState('');
  const [pendingPrevista, setPendingPrevista] = useState('');
  const [pendingTipoId, setPendingTipoId] = useState('');
  const [pendingPrioridadeTriagem, setPendingPrioridadeTriagem] = useState<string>('MEDIA');
  const [triagemMotivo, setTriagemMotivo] = useState('');

  useEffect(() => {
    if (!resumo) return;
    setPendingStatus(resumo.status);
    setMotivo('');
    setImpedimentoMotivo(resumo.impedimentoMotivo ?? '');
    setPendingEquipePlanejamentoId(resumo.equipe?.id ?? '');
    setPendingEquipeAtribuicaoId(resumo.equipe?.id ?? '');
    setPendingResponsavelId(resumo.responsavel?.id ?? '');
    setAtribuicaoMotivo('');
    setPendingPrevista(resumo.previstaExecucaoEm ? resumo.previstaExecucaoEm.slice(0, 10) : '');
    setPendingTipoId(resumo.tipoChamado?.id ?? '');
    setPendingPrioridadeTriagem(resumo.prioridade);
    setTriagemMotivo('');
  }, [resumo?.id, resumo?.status, resumo?.impedimentoMotivo, resumo?.equipe?.id, resumo?.responsavel?.id, resumo?.previstaExecucaoEm, resumo?.tipoChamado?.id, resumo?.prioridade]);

  if (!resumo) {
    return (
      <Card elevation={1} className="flex h-full min-h-[320px] flex-col items-center justify-center text-center">
        <CardContent className="flex flex-col items-center gap-2 p-8">
          <Inbox className="h-8 w-8 text-[var(--ink-3)]" />
          <p className="text-[15px] font-semibold text-[var(--ink)]">Selecione um chamado</p>
          <p className="max-w-xs text-[13px] text-[var(--ink-3)]">
            Escolha um item da lista para ver prazo, responsável e linha do tempo.
          </p>
        </CardContent>
      </Card>
    );
  }

  const st = CHAMADO_STATUS_META[resumo.status] ?? { label: resumo.status, badge: 'neutral' as const };
  const canal = origemMeta(resumo.origem);
  const CanalIcon = canal.icon;
  const prazo = prazoInfo(resumo.prazoEm, resumo.status);
  const prevista = previstaExecucaoInfo(resumo.previstaExecucaoEm, resumo.status);
  const statusOptions = Object.keys(CHAMADO_STATUS_META) as ChamadoStatus[];
  const statusChanged = pendingStatus !== resumo.status;
  const previstaChanged =
    pendingPrevista !== (resumo.previstaExecucaoEm ? resumo.previstaExecucaoEm.slice(0, 10) : '');
  const equipePlanejamentoChanged = pendingEquipePlanejamentoId !== (resumo.equipe?.id ?? '');
  const planejamentoChanged = previstaChanged || equipePlanejamentoChanged;
  const atribuicaoChanged =
    pendingEquipeAtribuicaoId !== (resumo.equipe?.id ?? '') ||
    pendingResponsavelId !== (resumo.responsavel?.id ?? '');
  const triagemChanged =
    pendingTipoId !== (resumo.tipoChamado?.id ?? '') || pendingPrioridadeTriagem !== resumo.prioridade;
  const selectedEquipe = equipes.find((equipe) => equipe.id === pendingEquipeAtribuicaoId);
  const membrosEquipe = selectedEquipe?.membros.map((item) => item.usuario).filter((usuario) => usuario.ativo) ?? [];
  const timeline = detail?.historico?.length
    ? buildChamadoTimelineFromHistorico(detail.historico, resumo.status, resumo.createdAt)
    : buildChamadoTimelineFromHistorico([], resumo.status, resumo.createdAt);

  return (
    <Card elevation={1} className="h-full overflow-hidden">
      <CardContent className="flex h-full flex-col p-0">
        <div className="border-b border-[var(--line-2)] p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <span className="mono text-[13px] font-semibold text-[var(--brand-hover)]">{resumo.codigo}</span>
            <div className="flex flex-wrap items-center gap-1.5">
              <Button
                type="button"
                variant="outlined"
                size="sm"
                disabled={pdfBusy || busy}
                onClick={() => {
                  setPdfBusy(true);
                  void downloadChamadoPdf(resumo.id, resumo.codigo)
                    .then(() => snackbar.show('PDF gerado.', 'success'))
                    .catch((err) =>
                      snackbar.show(err instanceof Error ? err.message : 'Falha ao gerar PDF.', 'error'),
                    )
                    .finally(() => setPdfBusy(false));
                }}
              >
                <FileDown className="h-3.5 w-3.5" />
                {pdfBusy ? 'Gerando…' : 'PDF'}
              </Button>
              <Badge variant={prioridadeVariant(resumo.prioridade)}>{resumo.prioridade}</Badge>
              <Badge variant={st.badge}>{st.label}</Badge>
            </div>
          </div>
          <h2 className="mt-3 text-[17px] font-semibold leading-snug text-[var(--ink)]">{chamadoTitulo(resumo)}</h2>
          <ChamadoDescricaoExpandivel className="mt-2" descricao={resumo.descricao} />
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-[var(--ink-3)]">
            <span className="inline-flex items-center gap-1.5">
              <Building2 className="h-3.5 w-3.5" />
              {chamadoLocalLabel(resumo)}
            </span>
            {resumo.unidade?.codigoPatrimonial ? <span className="mono">{resumo.unidade.codigoPatrimonial}</span> : null}
          </div>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto p-5">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryCard
              label="Prevista execução"
              value={prevista.label}
              sub={prevista.date ?? undefined}
              tone={prevista.tone === 'brand' ? 'neutral' : prevista.tone}
            />
            <SummaryCard label="Prazo SLA" value={prazo.value} sub={prazo.sub} tone={prazo.tone} />
            {resumo.tipoChamado ? (
              <SummaryCard
                label="Análise técnica"
                value={resumo.tipoChamado.exigeVistoriaPrevia ? 'Exigida' : 'Não exigida'}
                sub={resumo.tipoChamado.nome}
                tone={resumo.tipoChamado.exigeVistoriaPrevia ? 'warning' : 'neutral'}
              />
            ) : null}
            {resumo.status === 'EM_AVALIACAO_TECNICA' ? (
              <SummaryCard label="Fluxo" value="ANÁLISE TÉCNICA" sub="EXECUÇÃO" tone="warning" />
            ) : null}
            <SummaryCard label="Equipe" value={resumo.equipe?.nome ?? 'Não atribuída'} sub={resumo.secretaria.sigla} />
            <SummaryCard
              label="Secretaria responsável pela execução"
              value={resumo.secretaria.sigla}
              sub={resumo.secretaria.nome}
            />
            {resumo.unidade?.secretaria ? (
              <SummaryCard
                label="Secretaria responsável pelo próprio"
                value={resumo.unidade.secretaria.sigla}
                sub={resumo.unidade.secretaria.nome}
              />
            ) : null}
            <SummaryCard
              label="Responsável"
              value={resumo.responsavel?.nome ?? 'Não atribuído'}
              sub={membrosEquipe.length ? `${membrosEquipe.length} membro(s) na equipe` : undefined}
            />
            <SummaryCard label="Canal" value={canal.label} />
          </div>

          <div className="space-y-3 rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--surface-2)] p-4">
            <p className="text-[11px] font-bold tracking-wide text-[var(--ink-3)] uppercase">Alterar status</p>
            <div className="grid gap-3 sm:grid-cols-[minmax(180px,220px)_1fr]">
              <div>
                <label htmlFor="chamado-status" className="mb-1 block text-[11px] font-semibold text-[var(--ink-3)]">
                  Status
                </label>
                <Select
                  id="chamado-status"
                  value={pendingStatus}
                  onChange={(event) => setPendingStatus(event.target.value as ChamadoStatus)}
                  className="h-9 w-full text-xs"
                  disabled={busy}
                >
                  {statusOptions.map((status) => (
                    <option key={status} value={status}>
                      {status === resumo.status ? `${chamadoStatusLabel(status)} (atual)` : chamadoStatusLabel(status)}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <label htmlFor="chamado-motivo" className="mb-1 block text-[11px] font-semibold text-[var(--ink-3)]">
                  Motivo da alteração
                </label>
                <input
                  id="chamado-motivo"
                  value={motivo}
                  onChange={(event) => setMotivo(event.target.value)}
                  placeholder="Ex.: retorno para triagem, aguardando peça…"
                  disabled={busy}
                  className="h-9 w-full rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--surface)] px-3 text-[13px] focus:border-[var(--brand)] focus:outline-none focus:shadow-[0_0_0_3px_var(--brand-soft)]"
                />
              </div>
            </div>

            {pendingStatus === 'IMPEDIDO' ? (
              <div>
                <label htmlFor="chamado-impedimento" className="mb-1 block text-[11px] font-semibold text-[var(--ink-3)]">
                  Motivo do impedimento
                </label>
                <input
                  id="chamado-impedimento"
                  value={impedimentoMotivo}
                  onChange={(event) => setImpedimentoMotivo(event.target.value)}
                  placeholder="Descreva o que está bloqueando o atendimento"
                  disabled={busy}
                  className="h-9 w-full rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--surface)] px-3 text-[13px] focus:border-[var(--brand)] focus:outline-none focus:shadow-[0_0_0_3px_var(--brand-soft)]"
                />
              </div>
            ) : null}

            <Button
              variant="filled"
              size="sm"
              disabled={busy || !statusChanged}
              onClick={() =>
                onTransition(
                  resumo.id,
                  pendingStatus,
                  resumo.codigo,
                  motivo,
                  pendingStatus === 'IMPEDIDO' ? impedimentoMotivo : undefined,
                )
              }
            >
              Salvar status
            </Button>
          </div>

          <div className="space-y-3 rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--surface-2)] p-4">
            <p className="text-[11px] font-bold tracking-wide text-[var(--ink-3)] uppercase">Triagem</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="chamado-tipo-triagem" className="mb-1 block text-[11px] font-semibold text-[var(--ink-3)]">
                  Tipo do chamado
                </label>
                <Select
                  id="chamado-tipo-triagem"
                  value={pendingTipoId}
                  onChange={(event) => setPendingTipoId(event.target.value)}
                  className="h-9 w-full text-xs"
                  disabled={busy}
                >
                  <option value="">Sem tipo</option>
                  {tiposChamado.map((tipo) => (
                    <option key={tipo.id} value={tipo.id}>
                      {tipo.nome}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <label htmlFor="chamado-prioridade-triagem" className="mb-1 block text-[11px] font-semibold text-[var(--ink-3)]">
                  Prioridade
                </label>
                <Select
                  id="chamado-prioridade-triagem"
                  value={pendingPrioridadeTriagem}
                  onChange={(event) => setPendingPrioridadeTriagem(event.target.value)}
                  className="h-9 w-full text-xs"
                  disabled={busy}
                >
                  {TRIAGEM_PRIORIDADES.map((item) => (
                    <option key={item} value={item}>
                      {item.charAt(0) + item.slice(1).toLowerCase()}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
            <input
              value={triagemMotivo}
              onChange={(event) => setTriagemMotivo(event.target.value)}
              placeholder="Motivo da alteração (opcional)"
              disabled={busy}
              className="h-9 w-full rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--surface)] px-3 text-[13px] focus:border-[var(--brand)] focus:outline-none focus:shadow-[0_0_0_3px_var(--brand-soft)]"
            />
            <Button
              variant="outlined"
              size="sm"
              disabled={busy || !triagemChanged}
              onClick={() => {
                void onSaveTriagem(resumo.id, resumo.codigo, {
                  tipoChamadoId: pendingTipoId || null,
                  prioridade: pendingPrioridadeTriagem as (typeof TRIAGEM_PRIORIDADES)[number],
                  motivoAlteracao: triagemMotivo.trim() || undefined,
                });
              }}
            >
              Salvar triagem / recalcular SLA
            </Button>
          </div>

          <div className="space-y-3 rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--surface-2)] p-4">
            <p className="text-[11px] font-bold tracking-wide text-[var(--ink-3)] uppercase">Planejamento de execução</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="chamado-prevista" className="mb-1 block text-[11px] font-semibold text-[var(--ink-3)]">
                  Data prevista para execução
                </label>
                <input
                  id="chamado-prevista"
                  type="date"
                  min={toInputDate(new Date())}
                  value={pendingPrevista}
                  onChange={(event) => setPendingPrevista(event.target.value)}
                  disabled={busy}
                  className="h-9 w-full rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--surface)] px-3 text-[13px] focus:border-[var(--brand)] focus:outline-none focus:shadow-[0_0_0_3px_var(--brand-soft)]"
                />
              </div>
              <div>
                <label htmlFor="chamado-prevista-equipe" className="mb-1 block text-[11px] font-semibold text-[var(--ink-3)]">
                  Equipe de execução
                </label>
                <Select
                  id="chamado-prevista-equipe"
                  value={pendingEquipePlanejamentoId}
                  onChange={(event) => setPendingEquipePlanejamentoId(event.target.value)}
                  className="h-9 w-full text-xs"
                  disabled={busy}
                >
                  <option value="">Sem equipe</option>
                  {equipes.map((equipe) => (
                    <option key={equipe.id} value={equipe.id}>
                      {equipe.nome}
                      {equipe.secretaria?.sigla ? ` · ${equipe.secretaria.sigla}` : ''}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outlined"
                size="sm"
                disabled={busy || !planejamentoChanged}
                onClick={() =>
                  onSavePlanejamento(
                    resumo.id,
                    resumo.codigo,
                    pendingPrevista ? `${pendingPrevista}T12:00:00.000Z` : null,
                    equipePlanejamentoChanged ? pendingEquipePlanejamentoId || null : undefined,
                  )
                }
              >
                Salvar programação
              </Button>
              {pendingPrevista ? (
                <Button variant="text" size="sm" disabled={busy} onClick={() => setPendingPrevista('')}>
                  Limpar data
                </Button>
              ) : null}
            </div>
          </div>

          <div className="space-y-3 rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--surface-2)] p-4">
            <p className="text-[11px] font-bold tracking-wide text-[var(--ink-3)] uppercase">Atribuir equipe</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="chamado-equipe" className="mb-1 block text-[11px] font-semibold text-[var(--ink-3)]">
                  Equipe
                </label>
                <Select
                  id="chamado-equipe"
                  value={pendingEquipeAtribuicaoId}
                  onChange={(event) => {
                    setPendingEquipeAtribuicaoId(event.target.value);
                    setPendingResponsavelId('');
                  }}
                  className="h-9 w-full text-xs"
                  disabled={busy}
                >
                  <option value="">Sem equipe</option>
                  {equipes.map((equipe) => (
                    <option key={equipe.id} value={equipe.id}>
                      {equipe.nome}
                      {equipe.secretaria?.sigla ? ` · ${equipe.secretaria.sigla}` : ''}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <label htmlFor="chamado-responsavel" className="mb-1 block text-[11px] font-semibold text-[var(--ink-3)]">
                  Responsável
                </label>
                <Select
                  id="chamado-responsavel"
                  value={pendingResponsavelId}
                  onChange={(event) => setPendingResponsavelId(event.target.value)}
                  className="h-9 w-full text-xs"
                  disabled={busy || !pendingEquipeAtribuicaoId}
                >
                  <option value="">{pendingEquipeAtribuicaoId ? 'Selecione um membro' : 'Escolha uma equipe primeiro'}</option>
                  {membrosEquipe.map((usuario) => (
                    <option key={usuario.id} value={usuario.id}>
                      {usuario.nome}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
            <input
              value={atribuicaoMotivo}
              onChange={(event) => setAtribuicaoMotivo(event.target.value)}
              placeholder="Motivo da atribuição (opcional)"
              disabled={busy}
              className="h-9 w-full rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--surface)] px-3 text-[13px] focus:border-[var(--brand)] focus:outline-none focus:shadow-[0_0_0_3px_var(--brand-soft)]"
            />
            <Button
              variant="outlined"
              size="sm"
              disabled={busy || !atribuicaoChanged}
              onClick={() =>
                onAssignTeam(
                  resumo.id,
                  resumo.codigo,
                  pendingEquipeAtribuicaoId,
                  pendingResponsavelId,
                  atribuicaoMotivo,
                )
              }
            >
              Salvar equipe
            </Button>
            <Button
              variant="outlined"
              size="sm"
              disabled={busy || !resumo.equipe?.id}
              onClick={() => {
                void notificarChamadoEquipe(resumo.id)
                  .then((result) =>
                    snackbar.show(
                      result.delivered ? 'Equipe notificada por e-mail.' : 'Notificação registrada (e-mail em modo log).',
                      result.delivered ? 'success' : 'warning',
                    ),
                  )
                  .catch((err) => snackbar.show(err instanceof Error ? err.message : 'Falha ao notificar equipe.', 'error'));
              }}
            >
              Notificar equipe
            </Button>
          </div>

          <ChamadoAberturaSection resumo={resumo} busy={busy} onSaved={onRefreshDetail} />

          {resumo.fotoUrl ? (
            <div>
              <p className="text-[11px] font-bold tracking-wide text-[var(--ink-3)] uppercase">Foto anexada</p>
              <div className="mt-2">
                <ZoomableAuthenticatedImage
                  src={resumo.fotoUrl}
                  alt="Foto do chamado"
                  className="max-h-56 w-full object-cover"
                  previewClassName="max-h-[88vh] object-contain"
                />
              </div>
            </div>
          ) : null}

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

          {detail?.impedimentoMotivo || resumo.impedimentoMotivo ? (
            <div className="rounded-[var(--r-md)] border border-[var(--warn-bd)] bg-[var(--warn-bg)] p-3 text-[13px] text-[var(--warn)]">
              <strong>Impedimento:</strong> {detail?.impedimentoMotivo ?? resumo.impedimentoMotivo}
            </div>
          ) : null}

          <div>
            <div className="mb-3">
              <ChamadoHistoricoForm chamadoId={resumo.id} disabled={busy} onSaved={onRefreshDetail} />
            </div>
            <p className="mb-3 text-[11px] font-bold tracking-wide text-[var(--ink-3)] uppercase">Linha do tempo</p>
            {loading ? <LoadingState label="Carregando timeline..." /> : <ChamadoTimeline steps={timeline} />}
          </div>
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

function DetailField({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <dt className="text-[11px] font-bold tracking-wide text-[var(--ink-3)] uppercase">{label}</dt>
      <dd className="mt-0.5 text-[13px] font-medium text-[var(--ink-2)]">{children}</dd>
    </div>
  );
}
