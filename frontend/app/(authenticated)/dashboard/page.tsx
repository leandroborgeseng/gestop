'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, BarChart3, Building2, ClipboardCheck, DatabaseZap, ShieldAlert, Wrench } from 'lucide-react';
import { RequirePermissions } from '@/components/auth/require-permissions';
import { PageShell } from '@/components/layout/page-shell';
import { MetricCard } from '@/components/metric-card';
import { Alert } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ErrorState, LoadingState } from '@/components/ui-states';
import { PushNotificationsPanel } from '@/components/dashboard/push-notifications-panel';
import { getAlertasOperacionais, getDashboard, listAuditoria } from '@/lib/api';
import { AlertasOperacionais, AuditoriaEvento, DashboardData } from '@/lib/types';

export default function DashboardPage() {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [alertas, setAlertas] = useState<AlertasOperacionais | null>(null);
  const [auditoria, setAuditoria] = useState<AuditoriaEvento[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getDashboard(), listAuditoria(), getAlertasOperacionais()])
      .then(([dash, audit, alerts]) => {
        setDashboard(dash);
        setAuditoria(audit);
        setAlertas(alerts);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Falha ao carregar dashboard.'))
      .finally(() => setLoading(false));
  }, []);

  const hasAlertas =
    alertas &&
    (alertas.resumo.osAtrasadas > 0 ||
      alertas.resumo.chamadosSemTriagem > 0 ||
      alertas.resumo.syncFalhas > 0 ||
      alertas.resumo.osUrgentes > 0);

  return (
    <RequirePermissions permissions={['dashboard.visualizar']}>
      <PageShell
        kicker="Monitoramento"
        icon={BarChart3}
        title="Dashboard operacional e auditoria"
        description="Indicadores consolidados, pendências por secretaria e trilha recente de auditoria."
        backHref="/cco"
      >
        {error ? <div className="mb-6"><ErrorState message={error} /></div> : null}
        {loading ? <LoadingState label="Carregando indicadores..." /> : null}

        {dashboard ? (
          <>
            <PushNotificationsPanel />

            {hasAlertas ? (
              <Alert variant="warning" className="mb-6">
                <p className="md-title-md flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Alertas operacionais
                </p>
                <p className="md-body-md mt-2">
                  {alertas!.resumo.osAtrasadas} OS atrasadas · {alertas!.resumo.chamadosSemTriagem} chamados sem triagem
                  · {alertas!.resumo.osUrgentes} OS urgentes · {alertas!.resumo.syncFalhas} falhas de sync
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link
                    href="/ordens-servico"
                    className="inline-flex h-9 items-center rounded-[var(--md-shape-full)] bg-[var(--color-brand-primary)] px-3 md-label-lg text-white"
                  >
                    Ver ordens de servico
                  </Link>
                  <Link
                    href="/chamados"
                    className="inline-flex h-9 items-center rounded-[var(--md-shape-full)] border border-[var(--md-outline)] px-3 md-label-lg text-[var(--color-brand-primary)]"
                  >
                    Ver chamados
                  </Link>
                </div>
              </Alert>
            ) : null}

            <section className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
              <MetricCard title="Próprios" value={dashboard.indicadores.totalUnidades} hint="cadastrados" icon={Building2} />
              <MetricCard title="Fiscalizações" value={dashboard.indicadores.fiscalizacoes} hint="registradas" icon={ClipboardCheck} />
              <MetricCard title="Não conformidades" value={dashboard.indicadores.naoConformidades} hint="em acompanhamento" icon={ShieldAlert} />
              <MetricCard title="OS abertas" value={dashboard.indicadores.ordensServico.abertas} hint="aguardando ação" icon={Wrench} />
              <MetricCard title="OS em execução" value={dashboard.indicadores.ordensServico.emExecucao} hint="em andamento" icon={Wrench} />
              <MetricCard title="Sync pendente" value={dashboard.indicadores.syncPendentes} hint="eventos offline" icon={DatabaseZap} />
            </section>

            <section className="grid gap-6 lg:grid-cols-2">
              <Card elevation={1}>
                <CardHeader>
                  <CardTitle>Pendências por secretaria</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 pt-0">
                  {dashboard.pendenciasPorSecretaria.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-[var(--md-shape-md)] bg-[var(--md-surface-container-low)] p-4"
                    >
                      <strong className="md-title-md text-[var(--md-on-surface)]">{item.sigla}</strong>
                      <span className="md-body-md text-[var(--md-on-surface-variant)]"> — {item.nome}</span>
                      <p className="md-body-md mt-1 text-[var(--md-on-surface-variant)]">
                        {item.ordensPendentes} OS pendentes · {item.fiscalizacoes} fiscalizações
                      </p>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card elevation={1}>
                <CardHeader>
                  <CardTitle>Últimos eventos de auditoria</CardTitle>
                </CardHeader>
                <CardContent className="max-h-[520px] space-y-2 overflow-auto pt-0">
                  {auditoria.map((evento) => (
                    <div
                      key={evento.id}
                      className="rounded-[var(--md-shape-md)] border border-[var(--md-outline-variant)] p-3"
                    >
                      <strong className="md-title-md text-[var(--md-on-surface)]">{evento.acao}</strong>
                      <span className="md-body-md text-[var(--md-on-surface-variant)]"> em {evento.entidadeTipo}</span>
                      <p className="md-body-md mt-1 text-[var(--md-on-surface-variant)]">
                        {evento.usuario?.nome ?? 'Sistema'} · {new Date(evento.createdAt).toLocaleString('pt-BR')}
                      </p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </section>
          </>
        ) : null}
      </PageShell>
    </RequirePermissions>
  );
}
