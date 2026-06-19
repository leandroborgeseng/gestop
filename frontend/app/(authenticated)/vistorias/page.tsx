'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ClipboardList, MapPin, Search, UserRound } from 'lucide-react';
import { RequirePermissions } from '@/components/auth/require-permissions';
import { useSessionUser } from '@/components/auth/session-context';
import { PageShell } from '@/components/layout/page-shell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Select } from '@/components/ui/select';
import { Sheet } from '@/components/ui/sheet';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui-states';
import { getFiscalizacao, getSecretarias, listAdminUsuarios, listFiscalizacoes } from '@/lib/api';
import { cn } from '@/lib/cn';
import type { AdminUsuario, FiscalizacaoDetalhe, FiscalizacaoResumo, FiscalizacaoStatus, SecretariaOption } from '@/lib/types';

const PAGE_SIZE = 50;

const STATUS_OPTIONS: Array<{ value: '' | FiscalizacaoStatus; label: string }> = [
  { value: '', label: 'Todas' },
  { value: 'CONCLUIDA', label: 'Concluídas' },
  { value: 'EM_ANDAMENTO', label: 'Em andamento' },
  { value: 'PLANEJADA', label: 'Planejadas' },
  { value: 'SINCRONIZACAO_PENDENTE', label: 'Sincronização pendente' },
  { value: 'CANCELADA', label: 'Canceladas' },
];

const STATUS_BADGE: Record<FiscalizacaoStatus, 'success' | 'warning' | 'info' | 'muted' | 'danger'> = {
  CONCLUIDA: 'success',
  EM_ANDAMENTO: 'warning',
  PLANEJADA: 'info',
  SINCRONIZACAO_PENDENTE: 'warning',
  CANCELADA: 'muted',
};

function statusLabel(status: FiscalizacaoStatus) {
  return STATUS_OPTIONS.find((item) => item.value === status)?.label ?? status;
}

function formatDateTime(value: string | null | undefined) {
  return value ? new Date(value).toLocaleString('pt-BR') : '—';
}

export default function VistoriasPage() {
  const sessionUser = useSessionUser();
  const canFilterSecretaria = Boolean(
    sessionUser?.permissoes.some((permission) =>
      ['dashboard.visualizar', 'chamados.gerenciar', 'secretarias.gerenciar'].includes(permission),
    ),
  );
  const canFilterAgente = Boolean(sessionUser?.permissoes.includes('usuarios.gerenciar'));

  const [items, setItems] = useState<FiscalizacaoResumo[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<FiscalizacaoDetalhe | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [questionarioOpen, setQuestionarioOpen] = useState(false);

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'' | FiscalizacaoStatus>('CONCLUIDA');
  const [secretariaId, setSecretariaId] = useState('');
  const [agenteId, setAgenteId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const [secretarias, setSecretarias] = useState<SecretariaOption[]>([]);
  const [usuarios, setUsuarios] = useState<AdminUsuario[]>([]);

  useEffect(() => {
    if (canFilterSecretaria) {
      getSecretarias()
        .then(setSecretarias)
        .catch(() => undefined);
    }
    if (canFilterAgente) {
      listAdminUsuarios()
        .then(setUsuarios)
        .catch(() => undefined);
    }
  }, [canFilterSecretaria, canFilterAgente]);

  const filters = useMemo(
    () => ({
      q: search.trim() || undefined,
      status: status || undefined,
      secretariaId: secretariaId || undefined,
      agenteId: agenteId || undefined,
      from: from || undefined,
      to: to || undefined,
    }),
    [search, status, secretariaId, agenteId, from, to],
  );

  const loadList = useCallback(async (offset = 0, append = false) => {
    if (offset === 0) setLoading(true);
    else setLoadingMore(true);
    setError(null);

    try {
      const response = await listFiscalizacoes({ ...filters, limit: PAGE_SIZE, offset });
      setItems((current) => (append ? [...current, ...response.items] : response.items));
      setTotal(response.total);
      setHasMore(response.hasMore);
      if (!append) {
        setSelectedId((current) => current ?? response.items[0]?.id ?? null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar vistorias.');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [filters]);

  useEffect(() => {
    void loadList(0, false);
  }, [loadList]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }

    let active = true;
    setDetailLoading(true);
    getFiscalizacao(selectedId)
      .then((data) => {
        if (active) setDetail(data);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : 'Falha ao carregar detalhe da vistoria.');
      })
      .finally(() => {
        if (active) setDetailLoading(false);
      });

    return () => {
      active = false;
    };
  }, [selectedId]);

  const selected = useMemo(
    () => items.find((item) => item.id === selectedId) ?? null,
    [items, selectedId],
  );

  return (
    <RequirePermissions permissions={['fiscalizacoes.executar', 'dashboard.visualizar', 'chamados.gerenciar']} match="any">
      <PageShell
        kicker="Consulta operacional"
        icon={ClipboardList}
        title="Vistorias realizadas"
        description="Consulte vistorias registradas no sistema com filtros por período, agente e unidade."
        backHref="/mobile"
        action={
          <Link href="/mobile">
            <Button variant="outlined" size="sm">
              Nova vistoria
            </Button>
          </Link>
        }
      >
        {error ? <ErrorState message={error} /> : null}

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
          <section className="space-y-4">
            <Card elevation={1}>
              <CardContent className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
                <div className="relative sm:col-span-2 lg:col-span-3">
                  <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[var(--ink-3)]" />
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Buscar por unidade, código patrimonial, agente ou checklist…"
                    className="h-10 w-full rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--surface)] pr-3 pl-9 text-[13px]"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-[var(--ink-3)]">Status</label>
                  <Select value={status} onChange={(event) => setStatus(event.target.value as '' | FiscalizacaoStatus)} className="h-9 w-full text-xs">
                    {STATUS_OPTIONS.map((item) => (
                      <option key={item.value || 'all'} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </Select>
                </div>
                {canFilterSecretaria ? (
                  <div>
                    <label className="mb-1 block text-[11px] font-semibold text-[var(--ink-3)]">Secretaria</label>
                    <Select value={secretariaId} onChange={(event) => setSecretariaId(event.target.value)} className="h-9 w-full text-xs">
                      <option value="">Todas</option>
                      {secretarias.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.sigla} — {item.nome}
                        </option>
                      ))}
                    </Select>
                  </div>
                ) : null}
                {canFilterAgente ? (
                  <div>
                    <label className="mb-1 block text-[11px] font-semibold text-[var(--ink-3)]">Agente</label>
                    <Select value={agenteId} onChange={(event) => setAgenteId(event.target.value)} className="h-9 w-full text-xs">
                      <option value="">Todos</option>
                      {usuarios.filter((item) => item.ativo).map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.nome}
                        </option>
                      ))}
                    </Select>
                  </div>
                ) : null}
                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-[var(--ink-3)]">De</label>
                  <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} className="h-9 w-full rounded-[var(--r-md)] border border-[var(--line)] px-3 text-[13px]" />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-[var(--ink-3)]">Até</label>
                  <input type="date" value={to} onChange={(event) => setTo(event.target.value)} className="h-9 w-full rounded-[var(--r-md)] border border-[var(--line)] px-3 text-[13px]" />
                </div>
              </CardContent>
            </Card>

            <Card elevation={1} className="overflow-hidden">
              <div className="border-b border-[var(--line-2)] px-4 py-3 text-[12px] text-[var(--ink-3)]">
                {total} vistoria{total === 1 ? '' : 's'} encontrada{total === 1 ? '' : 's'}
              </div>
              <div className="max-h-[min(520px,70vh)] overflow-y-auto p-2">
                {loading ? (
                  <LoadingState label="Carregando vistorias..." />
                ) : items.length === 0 ? (
                  <EmptyState title="Nenhuma vistoria" description="Ajuste os filtros ou registre uma nova vistoria em campo." />
                ) : (
                  items.map((item) => {
                    const isSelected = selectedId === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setSelectedId(item.id)}
                        className={cn(
                          'mb-1 flex w-full flex-col gap-1.5 rounded-[var(--r-md)] border border-transparent px-3 py-3 text-left transition-colors',
                          isSelected
                            ? 'border-[color-mix(in_srgb,var(--brand)_30%,transparent)] bg-[var(--brand-soft)]'
                            : 'hover:bg-[var(--surface-2)]',
                        )}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[13px] font-semibold text-[var(--ink)]">{item.unidade.nome}</span>
                          <Badge variant={STATUS_BADGE[item.status]}>{statusLabel(item.status)}</Badge>
                        </div>
                        <p className="text-[12px] text-[var(--ink-3)]">
                          {item.unidade.codigoPatrimonial} · {item.secretaria.sigla}
                        </p>
                        <p className="text-[12px] text-[var(--ink-2)]">{item.checklistVersao.checklist.nome}</p>
                        <div className="flex flex-wrap gap-3 pt-1 text-[11px] text-[var(--ink-3)]">
                          <span className="inline-flex items-center gap-1">
                            <UserRound className="h-3 w-3" />
                            {item.agente.nome}
                          </span>
                          <span>{formatDateTime(item.concluidaEm ?? item.iniciadaEm)}</span>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
              {hasMore ? (
                <div className="border-t border-[var(--line-2)] p-3">
                  <Button variant="outlined" size="sm" className="w-full" disabled={loadingMore} onClick={() => void loadList(items.length, true)}>
                    {loadingMore ? 'Carregando...' : 'Carregar mais'}
                  </Button>
                </div>
              ) : null}
            </Card>
          </section>

          <section className="min-h-[320px]">
            {!selected ? (
              <Card elevation={1} className="flex h-full min-h-[320px] items-center justify-center p-8 text-center">
                <div>
                  <MapPin className="mx-auto h-8 w-8 text-[var(--ink-3)]" />
                  <p className="mt-3 text-[15px] font-semibold text-[var(--ink)]">Selecione uma vistoria</p>
                  <p className="mt-1 text-[13px] text-[var(--ink-3)]">Os detalhes do checklist e das respostas aparecem aqui.</p>
                </div>
              </Card>
            ) : (
              <Card elevation={1} className="h-full overflow-hidden">
                <CardContent className="flex h-full flex-col p-0">
                  <div className="border-b border-[var(--line-2)] p-5">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-[11px] font-bold tracking-wide text-[var(--ink-3)] uppercase">Unidade</p>
                        <h2 className="mt-1 text-[17px] font-semibold text-[var(--ink)]">{selected.unidade.nome}</h2>
                        <p className="mt-1 text-[13px] text-[var(--ink-3)]">
                          {selected.unidade.codigoPatrimonial} · {selected.secretaria.sigla}
                        </p>
                      </div>
                      <Badge variant={STATUS_BADGE[selected.status]}>{statusLabel(selected.status)}</Badge>
                    </div>
                  </div>

                  <div className="flex-1 space-y-4 overflow-y-auto p-5">
                    {detailLoading ? <LoadingState label="Carregando detalhe..." /> : null}
                    <dl className="grid gap-3 sm:grid-cols-2">
                      <DetailField label="Checklist">{selected.checklistVersao.checklist.nome} (v{selected.checklistVersao.versao})</DetailField>
                      <DetailField label="Agente">{selected.agente.nome}</DetailField>
                      <DetailField label="Iniciada em">{formatDateTime(selected.iniciadaEm)}</DetailField>
                      <DetailField label="Concluída em">{formatDateTime(selected.concluidaEm)}</DetailField>
                      <DetailField label="Dentro do raio">
                        {selected.dentroRaioPermitido == null ? '—' : selected.dentroRaioPermitido ? 'Sim' : 'Não'}
                      </DetailField>
                      <DetailField label="Distância check-in">
                        {selected.distanciaCheckinMetros != null ? `${Math.round(selected.distanciaCheckinMetros)} m` : '—'}
                      </DetailField>
                    </dl>

                    {detail?.respostas?.length ? (
                      <Button variant="outlined" size="sm" onClick={() => setQuestionarioOpen(true)}>
                        <ClipboardList className="mr-1.5 h-3.5 w-3.5" />
                        Exibir questionário
                      </Button>
                    ) : null}

                    {detail?.observacoes ? (
                      <div>
                        <p className="text-[11px] font-bold tracking-wide text-[var(--ink-3)] uppercase">Observações</p>
                        <p className="mt-1 text-[13px] text-[var(--ink-2)]">{detail.observacoes}</p>
                      </div>
                    ) : null}

                    {detail?.naoConformidades?.length ? (
                      <div>
                        <p className="mb-2 text-[11px] font-bold tracking-wide text-[var(--ink-3)] uppercase">Não conformidades</p>
                        <div className="space-y-2">
                          {detail.naoConformidades.map((nc) => (
                            <div key={nc.id} className="rounded-[var(--r-md)] border border-[var(--warn-bd)] bg-[var(--warn-bg)] p-3 text-[13px]">
                              <p className="font-semibold text-[var(--warn)]">{nc.item.codigo} — {nc.item.titulo}</p>
                              <p className="mt-1 text-[var(--ink-2)]">{nc.descricao}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {detail?.respostas?.length ? (
                      <div>
                        <p className="mb-2 text-[11px] font-bold tracking-wide text-[var(--ink-3)] uppercase">Respostas do checklist</p>
                        <div className="space-y-2">
                          {detail.respostas.map((resposta) => (
                            <div key={resposta.id} className="rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--surface-2)] p-3">
                              <p className="text-[12px] font-semibold text-[var(--ink)]">
                                {resposta.item.codigo} — {resposta.item.titulo}
                              </p>
                              <p className="mt-1 text-[13px] text-[var(--ink-2)]">
                                {resposta.valorTexto ??
                                  (resposta.valorBooleano != null ? (resposta.valorBooleano ? 'Sim' : 'Não') : null) ??
                                  (resposta.valorNumero != null ? String(resposta.valorNumero) : null) ??
                                  resposta.conformidade ??
                                  '—'}
                              </p>
                              {resposta.comentario ? (
                                <p className="mt-1 text-[12px] text-[var(--ink-3)]">{resposta.comentario}</p>
                              ) : null}
                              {resposta.naoConformidade?.chamado ? (
                                <p className="mt-2 text-[12px]">
                                  Chamado gerado:{' '}
                                  <Link href={`/chamados?search=${encodeURIComponent(resposta.naoConformidade.chamado.codigo)}`} className="font-semibold text-[var(--brand)] hover:underline">
                                    {resposta.naoConformidade.chamado.codigo}
                                  </Link>
                                </p>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            )}
          </section>
        </div>

        <Sheet open={questionarioOpen} onClose={() => setQuestionarioOpen(false)} title="Questionário da vistoria">
          <div className="space-y-3">
            {(detail?.respostas ?? []).map((resposta) => (
              <div key={resposta.id} className="rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--surface-2)] p-3">
                <p className="text-[12px] font-semibold text-[var(--ink)]">
                  {resposta.item.codigo} — {resposta.item.titulo}
                </p>
                <p className="mt-1 text-[13px] text-[var(--ink-2)]">
                  {resposta.valorTexto ??
                    (resposta.valorBooleano != null ? (resposta.valorBooleano ? 'Sim' : 'Não') : null) ??
                    (resposta.valorNumero != null ? String(resposta.valorNumero) : null) ??
                    resposta.conformidade ??
                    '—'}
                </p>
                {resposta.comentario ? <p className="mt-1 text-[12px] text-[var(--ink-3)]">{resposta.comentario}</p> : null}
                {resposta.naoConformidade?.chamado ? (
                  <p className="mt-2 text-[12px]">
                    Chamado:{' '}
                    <Link href={`/chamados?search=${encodeURIComponent(resposta.naoConformidade.chamado.codigo)}`} className="font-semibold text-[var(--brand)] hover:underline">
                      {resposta.naoConformidade.chamado.codigo}
                    </Link>
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        </Sheet>
      </PageShell>
    </RequirePermissions>
  );
}

function DetailField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] font-bold tracking-wide text-[var(--ink-3)] uppercase">{label}</dt>
      <dd className="mt-0.5 text-[13px] font-medium text-[var(--ink-2)]">{children}</dd>
    </div>
  );
}
