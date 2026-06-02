'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  Bell,
  Building2,
  Clock,
  Crosshair,
  GitBranch,
  Inbox,
  Megaphone,
  Search,
  Smartphone,
  Wrench,
} from 'lucide-react';
import { RequirePermissions } from '@/components/auth/require-permissions';
import { PageShell } from '@/components/layout/page-shell';
import { TipBanner } from '@/components/help/tip-banner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { useSnackbar } from '@/components/ui/snackbar';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui-states';
import { convertChamadoToOs, listChamados, updateChamadoStatus } from '@/lib/api';
import { cn } from '@/lib/cn';
import { ChamadoOrigem, ChamadoResumo, ChamadoStatus } from '@/lib/types';

type StatusFilter = 'TODOS' | ChamadoStatus;

const STATUS_CHIPS: Array<{ value: StatusFilter; label: string }> = [
  { value: 'TODOS', label: 'Todos' },
  { value: 'ABERTO', label: 'Abertos' },
  { value: 'EM_TRIAGEM', label: 'Em triagem' },
  { value: 'ENCAMINHADO_OS', label: 'Encaminhados' },
  { value: 'ENCERRADO', label: 'Encerrados' },
  { value: 'CANCELADO', label: 'Cancelados' },
];

const STATUS_META: Record<
  ChamadoStatus,
  { label: string; badge: 'info' | 'warning' | 'brand' | 'success' | 'muted' | 'danger' }
> = {
  ABERTO: { label: 'Aberto', badge: 'info' },
  EM_TRIAGEM: { label: 'Em triagem', badge: 'warning' },
  ENCAMINHADO_OS: { label: 'Encaminhado p/ OS', badge: 'brand' },
  ENCERRADO: { label: 'Encerrado', badge: 'success' },
  CANCELADO: { label: 'Cancelado', badge: 'muted' },
};

function prioridadeVariant(prioridade: string): 'danger' | 'warning' | 'neutral' {
  const value = prioridade.toUpperCase();
  if (value.includes('ALTA') || value.includes('URG')) return 'danger';
  if (value.includes('MED')) return 'warning';
  return 'neutral';
}

function origemMeta(origem: ChamadoOrigem) {
  switch (origem) {
    case 'QR_CODE':
      return { label: 'QR Code', icon: Crosshair };
    case 'INTERNO':
      return { label: 'App interno', icon: Smartphone };
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
  const snackbar = useSnackbar();
  const [chamados, setChamados] = useState<ChamadoResumo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<StatusFilter>('TODOS');
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

  function load() {
    setLoading(true);
    listChamados()
      .then((items) => {
        setChamados(items);
        setSelectedId((current) => current ?? items[0]?.id ?? null);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Falha ao carregar chamados.'))
      .finally(() => setLoading(false));
  }

  const counts = useMemo(() => {
    const next: Record<StatusFilter, number> = {
      TODOS: chamados.length,
      ABERTO: 0,
      EM_TRIAGEM: 0,
      ENCAMINHADO_OS: 0,
      ENCERRADO: 0,
      CANCELADO: 0,
    };
    for (const item of chamados) {
      next[item.status] += 1;
    }
    return next;
  }, [chamados]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return chamados.filter((item) => {
      if (filter !== 'TODOS' && item.status !== filter) return false;
      if (!query) return true;
      const haystack = [
        item.codigo,
        item.descricao,
        item.unidade.nome,
        item.unidade.codigoPatrimonial,
        item.solicitanteNome,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [chamados, filter, search]);

  const selected = useMemo(() => {
    if (selectedId) {
      const match = filtered.find((item) => item.id === selectedId);
      if (match) return match;
    }
    return filtered[0] ?? null;
  }, [filtered, selectedId]);

  async function changeStatus(id: string, status: ChamadoStatus, codigo: string) {
    setBusyId(id);
    setError(null);
    try {
      await updateChamadoStatus(id, { status, motivo: `Atualizado via painel para ${status}` });
      const items = await listChamados();
      setChamados(items);
      snackbar.show(`${codigo} ${statusToastLabel(status)}`, 'success');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Falha ao atualizar chamado.';
      setError(message);
      snackbar.show(message, 'error');
    } finally {
      setBusyId(null);
    }
  }

  async function convertToOs(id: string, codigo: string) {
    setBusyId(id);
    setError(null);
    try {
      await convertChamadoToOs(id);
      const items = await listChamados();
      setChamados(items);
      snackbar.show(`${codigo} encaminhado para ordem de serviço`, 'success');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Falha ao converter chamado em OS.';
      setError(message);
      snackbar.show(message, 'error');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <RequirePermissions permissions={['chamados.gerenciar']}>
      <PageShell
        kicker="Atendimento ao cidadão"
        icon={Megaphone}
        title="Chamados"
        description="Triagem e encaminhamento de chamados — abertos via QR Code, app de campo e registro interno."
        backHref="/cco"
      >
        <TipBanner id="chamados-triagem">
          Selecione um chamado na lista para ver detalhes e avançar o fluxo. Use os chips para filtrar por status.
        </TipBanner>

        {error ? (
          <div className="mb-4 shrink-0">
            <ErrorState message={error} onRetry={load} />
          </div>
        ) : null}

        <div className="situ-chips mb-4 flex shrink-0 flex-wrap gap-1.5">
          {STATUS_CHIPS.map((item) => (
            <Chip
              key={item.value}
              active={filter === item.value}
              count={counts[item.value]}
              onClick={() => setFilter(item.value)}
            >
              {item.label}
            </Chip>
          ))}
        </div>

        {loading ? <LoadingState label="Carregando chamados..." /> : null}

        {!loading ? (
          <div className="grid min-h-0 flex-1 gap-3.5 xl:grid-cols-[minmax(320px,388px)_1fr]">
            <section className="flex min-h-[420px] flex-col overflow-hidden rounded-[var(--r-card)] border border-[var(--line)] bg-[var(--surface)] shadow-[var(--sh-sm)] xl:min-h-[520px]">
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
                    description={filter === 'TODOS' ? 'Nenhum chamado registrado ainda.' : 'Nenhum chamado neste filtro.'}
                  />
                ) : (
                  filtered.map((chamado) => {
                    const st = STATUS_META[chamado.status];
                    const canal = origemMeta(chamado.origem);
                    const CanalIcon = canal.icon;
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
                        <p className="line-clamp-2 text-[13px] font-semibold text-[var(--ink)]">{chamado.descricao}</p>
                        <p className="truncate text-[12px] text-[var(--ink-3)]">{chamado.unidade.nome}</p>
                        <div className="flex flex-wrap items-center gap-2 pt-0.5">
                          <Badge variant={st.badge}>{st.label}</Badge>
                          <span className="inline-flex items-center gap-1 text-[11px] text-[var(--ink-3)]">
                            <Clock className="h-3 w-3" />
                            {new Date(chamado.createdAt).toLocaleDateString('pt-BR')}
                          </span>
                          <span className="inline-flex items-center gap-1 text-[11px] text-[var(--ink-3)]">
                            <CanalIcon className="h-3 w-3" />
                            {canal.label}
                          </span>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </section>

            <section className="min-h-[320px]">
              <ChamadoDetailPanel
                chamado={selected}
                busy={busyId === selected?.id}
                onChangeStatus={changeStatus}
                onConvertToOs={convertToOs}
              />
            </section>
          </div>
        ) : null}
      </PageShell>
    </RequirePermissions>
  );
}

function ChamadoDetailPanel({
  chamado,
  busy,
  onChangeStatus,
  onConvertToOs,
}: {
  chamado: ChamadoResumo | null;
  busy: boolean;
  onChangeStatus: (id: string, status: ChamadoStatus, codigo: string) => void;
  onConvertToOs: (id: string, codigo: string) => void;
}) {
  if (!chamado) {
    return (
      <Card elevation={1} className="flex h-full min-h-[320px] flex-col items-center justify-center text-center">
        <CardContent className="flex flex-col items-center gap-2 p-8">
          <Inbox className="h-8 w-8 text-[var(--ink-3)]" />
          <p className="text-[15px] font-semibold text-[var(--ink)]">Selecione um chamado</p>
          <p className="max-w-xs text-[13px] text-[var(--ink-3)]">
            Escolha um item da lista para ver detalhes e agir no fluxo de triagem.
          </p>
        </CardContent>
      </Card>
    );
  }

  const st = STATUS_META[chamado.status];
  const canal = origemMeta(chamado.origem);
  const CanalIcon = canal.icon;
  const canAct = chamado.status !== 'ENCERRADO' && chamado.status !== 'CANCELADO';

  return (
    <Card elevation={1} className="h-full overflow-hidden">
      <CardContent className="flex h-full flex-col p-0">
        <div className="border-b border-[var(--line-2)] p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <span className="mono text-[13px] font-semibold text-[var(--brand-hover)]">{chamado.codigo}</span>
            <div className="flex flex-wrap gap-1.5">
              <Badge variant={prioridadeVariant(chamado.prioridade)}>{chamado.prioridade}</Badge>
              <Badge variant={st.badge}>{st.label}</Badge>
            </div>
          </div>
          <h2 className="mt-3 text-[17px] font-semibold leading-snug text-[var(--ink)]">{chamado.descricao}</h2>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-[var(--ink-3)]">
            <span className="inline-flex items-center gap-1.5">
              <Building2 className="h-3.5 w-3.5" />
              {chamado.unidade.nome}
            </span>
            <span className="mono">{chamado.unidade.codigoPatrimonial}</span>
          </div>
        </div>

        <div className="flex-1 space-y-5 p-5">
          <dl className="grid gap-3 sm:grid-cols-2">
            <DetailField label="Canal">
              <span className="inline-flex items-center gap-1.5">
                <CanalIcon className="h-3.5 w-3.5" />
                {canal.label}
              </span>
            </DetailField>
            <DetailField label="Aberto em">
              {new Date(chamado.createdAt).toLocaleString('pt-BR')}
            </DetailField>
            <DetailField label="Secretaria">{chamado.secretaria.sigla}</DetailField>
            <DetailField label="Bairro">{chamado.unidade.bairro ?? '—'}</DetailField>
            <DetailField label="Solicitante" className="sm:col-span-2">
              {chamado.solicitanteNome ?? '—'}
              {chamado.solicitanteTelefone ? ` · ${chamado.solicitanteTelefone}` : ''}
            </DetailField>
          </dl>

          {chamado.unidade.endereco ? (
            <div>
              <p className="text-[11px] font-bold tracking-wide text-[var(--ink-3)] uppercase">Endereço</p>
              <p className="mt-1 text-[13px] text-[var(--ink-2)]">{chamado.unidade.endereco}</p>
            </div>
          ) : null}

          {chamado.ordemServico ? (
            <div className="rounded-[var(--r-md)] border border-[var(--brand-soft)] bg-[var(--brand-soft)] p-4">
              <p className="flex items-center gap-2 text-[12px] font-bold text-[var(--brand-hover)]">
                <GitBranch className="h-4 w-4" />
                Ordem de serviço vinculada
              </p>
              <p className="mt-2 text-[13px] text-[var(--ink-2)]">
                <Link href={`/ordens-servico/${chamado.ordemServico.id}`} className="font-semibold text-[var(--brand-hover)] underline">
                  {chamado.ordemServico.codigo}
                </Link>{' '}
                · {chamado.ordemServico.status}
              </p>
            </div>
          ) : null}

          {canAct ? (
            <div className="flex flex-wrap gap-2 border-t border-[var(--line-2)] pt-4">
              {chamado.status === 'ABERTO' ? (
                <Button
                  variant="filled"
                  size="sm"
                  disabled={busy}
                  onClick={() => onChangeStatus(chamado.id, 'EM_TRIAGEM', chamado.codigo)}
                >
                  Iniciar triagem
                </Button>
              ) : null}
              {!chamado.ordemServico && (chamado.status === 'ABERTO' || chamado.status === 'EM_TRIAGEM') ? (
                <Button
                  variant="tonal"
                  size="sm"
                  disabled={busy}
                  onClick={() => onConvertToOs(chamado.id, chamado.codigo)}
                >
                  <Wrench className="h-4 w-4" />
                  Encaminhar para OS
                </Button>
              ) : null}
              {chamado.status === 'EM_TRIAGEM' ? (
                <Button
                  variant="outlined"
                  size="sm"
                  disabled={busy}
                  onClick={() => onChangeStatus(chamado.id, 'ENCERRADO', chamado.codigo)}
                >
                  Encerrar
                </Button>
              ) : null}
              {chamado.status !== 'CANCELADO' ? (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={busy}
                  onClick={() => onChangeStatus(chamado.id, 'CANCELADO', chamado.codigo)}
                >
                  Cancelar
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
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

function statusToastLabel(status: ChamadoStatus) {
  switch (status) {
    case 'EM_TRIAGEM':
      return 'movido para triagem';
    case 'ENCERRADO':
      return 'encerrado';
    case 'CANCELADO':
      return 'cancelado';
    default:
      return `atualizado para ${status}`;
  }
}
