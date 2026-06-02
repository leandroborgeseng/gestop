'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { Building2, GitBranch, ImageIcon, Wrench } from 'lucide-react';
import { RequirePermissions } from '@/components/auth/require-permissions';
import { OsTimeline } from '@/components/ordens/os-timeline';
import { PageShell } from '@/components/layout/page-shell';
import { TipBanner } from '@/components/help/tip-banner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useSnackbar } from '@/components/ui/snackbar';
import { ErrorState, LoadingState } from '@/components/ui-states';
import { getOrdemServico, updateOrdemServico } from '@/lib/api';
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
import { OrdemServicoDetalhe } from '@/lib/types';

export default function OrdemServicoDetalhePage() {
  const params = useParams<{ id: string }>();
  const snackbar = useSnackbar();
  const [ordem, setOrdem] = useState<OrdemServicoDetalhe | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!params.id) return;
    getOrdemServico(params.id)
      .then(setOrdem)
      .catch((err) => setError(err instanceof Error ? err.message : 'Falha ao carregar OS.'))
      .finally(() => setLoading(false));
  }, [params.id]);

  const timeline = useMemo(() => {
    if (!ordem) return [];
    return buildOsTimeline(
      ordem.status,
      ordem.abertaEm,
      ordem.prazoEm,
      ordem.concluidaEm,
      ordem.responsavel?.nome,
      ordem.prioridade,
      ordem.origem,
    );
  }, [ordem]);

  async function transition(status: string) {
    if (!ordem) return;
    setError(null);
    setBusy(true);
    try {
      await updateOrdemServico(ordem.id, { status, motivo: `Transição via detalhe para ${status}` });
      const refreshed = await getOrdemServico(ordem.id);
      setOrdem(refreshed);
      snackbar.show(`${ordem.codigo} → ${osStatusLabel(status)}`, 'success');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Falha ao atualizar OS.';
      setError(message);
      snackbar.show(message, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function advanceStatus() {
    if (!ordem) return;
    const next = nextOsStatusFlow(ordem.status);
    if (next) await transition(next);
  }

  const st = ordem ? OS_STATUS_META[ordem.status] ?? { label: ordem.status, badge: 'neutral' as const } : null;
  const prazo = ordem ? prazoInfo(ordem.prazoEm, ordem.status) : null;
  const canAct = ordem && ordem.status !== 'CONCLUIDA' && ordem.status !== 'CANCELADA';

  return (
    <RequirePermissions permissions={['chamados.gerenciar']}>
      <PageShell
        kicker="Manutenção"
        icon={Wrench}
        title={ordem?.codigo ?? 'Detalhe da OS'}
        description="Linha do tempo, origem auditável e evidências vinculadas."
        backHref="/ordens-servico"
      >
        <TipBanner id="os-detalhe-timeline">
          Use a linha do tempo para acompanhar o fluxo. Transições de status ficam registradas no histórico auditável.
        </TipBanner>

        {error ? (
          <div className="mb-4">
            <ErrorState message={error} />
          </div>
        ) : null}
        {loading ? <LoadingState label="Carregando ordem de serviço..." /> : null}

        {ordem && st && prazo ? (
          <div className="space-y-5">
            <Card elevation={1}>
              <CardContent className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <span className="mono text-[13px] font-semibold text-[var(--brand-hover)]">{ordem.codigo}</span>
                  <div className="flex flex-wrap gap-1.5">
                    <Badge variant={prioridadeVariant(ordem.prioridade)}>{ordem.prioridade}</Badge>
                    <Badge variant={st.badge}>{st.label}</Badge>
                  </div>
                </div>
                <h1 className="mt-3 text-[20px] font-bold leading-snug text-[var(--ink)]">{ordem.titulo}</h1>
                <p className="mt-2 text-[14px] text-[var(--ink-3)]">{ordem.descricao}</p>
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-[var(--ink-3)]">
                  <span className="inline-flex items-center gap-1.5">
                    <Building2 className="h-3.5 w-3.5" />
                    {ordem.unidade.nome}
                  </span>
                  <span className="mono">{ordem.unidade.codigoPatrimonial}</span>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  <SummaryCard
                    label="Prazo"
                    value={prazo.label}
                    sub={ordem.prazoEm ? new Date(ordem.prazoEm).toLocaleDateString('pt-BR') : undefined}
                    tone={prazo.tone}
                  />
                  <SummaryCard label="Responsável" value={ordem.responsavel?.nome ?? 'Não atribuído'} sub={ordem.secretaria.sigla} />
                  <SummaryCard label="Origem" value={ordem.origem} />
                </div>

                {ordem.impedimentoMotivo ? (
                  <div className="mt-4 rounded-[var(--r-md)] border border-[var(--warn-bd)] bg-[var(--warn-bg)] p-3 text-[13px] text-[var(--warn)]">
                    <strong>Impedimento:</strong> {ordem.impedimentoMotivo}
                  </div>
                ) : null}

                {canAct ? (
                  <div className="mt-5 flex flex-wrap gap-2 border-t border-[var(--line-2)] pt-4">
                    {nextOsStatusFlow(ordem.status) ? (
                      <Button variant="filled" size="sm" disabled={busy} onClick={() => void advanceStatus()}>
                        Atualizar status
                      </Button>
                    ) : null}
                    {nextOsStatuses(ordem.status).includes('CONCLUIDA') ? (
                      <Button variant="outlined" size="sm" disabled={busy} onClick={() => void transition('CONCLUIDA')}>
                        Concluir OS
                      </Button>
                    ) : null}
                    {nextOsStatuses(ordem.status)
                      .filter((status) => status !== 'CONCLUIDA')
                      .map((status) => (
                        <Button key={status} variant="tonal" size="sm" disabled={busy} onClick={() => void transition(status)}>
                          {osStatusLabel(status)}
                        </Button>
                      ))}
                  </div>
                ) : null}
              </CardContent>
            </Card>

            <div className="grid gap-5 lg:grid-cols-2">
              <Card elevation={1}>
                <CardContent className="p-5">
                  <h2 className="mb-4 text-[13.5px] font-semibold text-[var(--ink)]">Linha do tempo</h2>
                  <OsTimeline steps={timeline} />
                </CardContent>
              </Card>

              <div className="space-y-5">
                {ordem.naoConformidade ? (
                  <Card elevation={1}>
                    <CardContent className="p-5">
                      <p className="flex items-center gap-2 text-[12px] font-bold text-[var(--brand-hover)]">
                        <GitBranch className="h-4 w-4" />
                        Origem auditável (NC)
                      </p>
                      <p className="mt-2 text-[13px] font-semibold text-[var(--ink)]">
                        {ordem.naoConformidade.item.codigo} — {ordem.naoConformidade.item.titulo}
                      </p>
                      <p className="mt-1 text-[13px] text-[var(--ink-3)]">{ordem.naoConformidade.descricao}</p>
                    </CardContent>
                  </Card>
                ) : null}

                {ordem.evidencias.length > 0 ? (
                  <Card elevation={1}>
                    <CardContent className="p-5">
                      <p className="mb-3 flex items-center gap-2 text-[13.5px] font-semibold text-[var(--ink)]">
                        <ImageIcon className="h-4 w-4" />
                        Evidências ({ordem.evidencias.length})
                      </p>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {ordem.evidencias.map((evidencia) => (
                          <a
                            key={evidencia.id}
                            href={evidencia.url}
                            target="_blank"
                            rel="noreferrer"
                            className="overflow-hidden rounded-[var(--r-md)] border border-[var(--line)]"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={evidencia.url} alt="Evidência" className="h-36 w-full object-cover" />
                          </a>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ) : null}
              </div>
            </div>

            <Card elevation={1}>
              <CardContent className="p-5">
                <h2 className="mb-3 text-[13.5px] font-semibold text-[var(--ink)]">Histórico de transições</h2>
                <div className="space-y-2">
                  {ordem.historico.length === 0 ? (
                    <p className="text-[13px] text-[var(--ink-3)]">Nenhuma transição registrada.</p>
                  ) : (
                    ordem.historico.map((evento) => (
                      <div key={evento.id} className="rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--surface-2)] p-3">
                        <p className="text-[13px] font-semibold text-[var(--ink)]">
                          {evento.statusAnterior ? `${evento.statusAnterior} → ${evento.statusNovo}` : evento.statusNovo}
                        </p>
                        {evento.motivo ? <p className="mt-0.5 text-[12px] text-[var(--ink-3)]">{evento.motivo}</p> : null}
                        <p className="mt-1 text-[11px] text-[var(--ink-3)]">
                          {new Date(evento.createdAt).toLocaleString('pt-BR')}
                          {evento.alteradoPor ? ` · ${evento.alteradoPor.nome}` : ''}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        ) : null}
      </PageShell>
    </RequirePermissions>
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
