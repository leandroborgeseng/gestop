'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, BarChart3, Building2, ClipboardCheck, DatabaseZap, ShieldAlert, Wrench } from 'lucide-react';
import { RequirePermissions } from '@/components/auth/require-permissions';
import { PageShell } from '@/components/layout/page-shell';
import { TipBanner } from '@/components/help/tip-banner';
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
        title="Dashboard operacional"
        description="Indicadores consolidados, alertas operacionais e trilha recente de auditoria."
        backHref="/cco"
      >
        <TipBanner id="dashboard-alertas">
          KPIs refletem o estado atual do sistema. Alertas operacionais destacam OS atrasadas, chamados sem triagem e falhas de sync.
        </TipBanner>

        {error ? (
          <div className="mb-6">
            <ErrorState message={error} />
          </div>
        ) : null}
        {loading ? <LoadingState label="Carregando indicadores..." /> : null}

        {dashboard ? (
          <>
            <PushNotificationsPanel />

            {hasAlertas ? (
              <Alert variant="warning" className="mb-6">
                <p className="flex items-center gap-2 text-[14px] font-semibold text-[var(--ink)]">
                  <AlertTriangle className="h-4 w-4" />
                  Alertas operacionais
                </p>
                <p className="mt-2 text-[13px] text-[var(--ink-2)]">
                  {alertas!.resumo.osAtrasadas} OS atrasadas · {alertas!.resumo.chamadosSemTriagem} chamados sem triagem ·{' '}
                  {alertas!.resumo.osUrgentes} OS urgentes · {alertas!.resumo.syncFalhas} falhas de sync
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link
                    href="/ordens-servico"
                    className="inline-flex h-8 items-center rounded-[var(--r-md)] bg-[var(--brand)] px-3 text-[12.5px] font-semibold text-white shadow-[var(--sh-sm)] hover:bg-[var(--brand-hover)]"
                  >
                    Ver ordens de serviço
                  </Link>
                  <Link
                    href="/chamados"
                    className="inline-flex h-8 items-center rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--surface)] px-3 text-[12.5px] font-semibold text-[var(--ink-2)] hover:bg-[var(--surface-2)]"
                  >
                    Ver chamados
                  </Link>
                </div>
              </Alert>
            ) : null}

            <section className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
              <MetricCard title="Próprios" value={dashboard.indicadores.totalUnidades} hint="cadastrados" icon={Building2} />
              <MetricCard title="Fiscalizações" value={dashboard.indicadores.fiscalizacoes} hint="registradas" icon={ClipboardCheck} />
              <MetricCard
                title="Não conformidades"
                value={dashboard.indicadores.naoConformidades}
                hint="em acompanhamento"
                icon={ShieldAlert}
                deltaTone={dashboard.indicadores.naoConformidades > 0 ? 'warn' : undefined}
              />
              <MetricCard title="OS abertas" value={dashboard.indicadores.ordensServico.abertas} hint="aguardando ação" icon={Wrench} />
              <MetricCard title="OS em execução" value={dashboard.indicadores.ordensServico.emExecucao} hint="em andamento" icon={Wrench} />
              <MetricCard
                title="Sync pendente"
                value={dashboard.indicadores.syncPendentes}
                hint="eventos offline"
                icon={DatabaseZap}
                deltaTone={dashboard.indicadores.syncPendentes > 0 ? 'warn' : undefined}
              />
            </section>

            <section className="grid gap-6 lg:grid-cols-2">
              <Card elevation={1}>
                <CardHeader>
                  <CardTitle className="text-[var(--ink)]">Pendências por secretaria</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 pt-0">
                  {dashboard.pendenciasPorSecretaria.length === 0 ? (
                    <p className="py-4 text-[13px] text-[var(--ink-3)]">Nenhuma pendência registrada.</p>
                  ) : null}
                  {dashboard.pendenciasPorSecretaria.map((item) => (
                    <div key={item.id} className="rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--surface-2)] p-4">
                      <strong className="text-[14px] font-semibold text-[var(--ink)]">{item.sigla}</strong>
                      <span className="text-[13px] text-[var(--ink-3)]"> — {item.nome}</span>
                      <p className="mt-1 text-[13px] text-[var(--ink-3)]">
                        {item.ordensPendentes} OS pendentes · {item.fiscalizacoes} fiscalizações
                      </p>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card elevation={1}>
                <CardHeader>
                  <CardTitle className="text-[var(--ink)]">Últimos eventos de auditoria</CardTitle>
                </CardHeader>
                <CardContent className="max-h-[520px] space-y-2 overflow-auto pt-0">
                  {auditoria.length === 0 ? (
                    <p className="py-4 text-[13px] text-[var(--ink-3)]">Nenhum evento recente.</p>
                  ) : null}
                  {auditoria.map((evento) => (
                    <div key={evento.id} className="rounded-[var(--r-md)] border border-[var(--line)] p-3">
                      <strong className="text-[13px] font-semibold text-[var(--ink)]">{evento.acao}</strong>
                      <span className="text-[13px] text-[var(--ink-3)]"> em {evento.entidadeTipo}</span>
                      <p className="mt-1 text-[12px] text-[var(--ink-3)]">
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
