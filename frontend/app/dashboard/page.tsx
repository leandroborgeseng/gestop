'use client';

import { useEffect, useState } from 'react';
import { BarChart3, Building2, ClipboardCheck, DatabaseZap, ShieldAlert, Wrench } from 'lucide-react';
import { AuthGate } from '@/components/auth-gate';
import { PageShell } from '@/components/layout/page-shell';
import { MetricCard } from '@/components/metric-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ErrorState, LoadingState } from '@/components/ui-states';
import { getDashboard, listAuditoria } from '@/lib/api';
import { AuditoriaEvento, DashboardData } from '@/lib/types';

export default function DashboardPage() {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [auditoria, setAuditoria] = useState<AuditoriaEvento[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getDashboard(), listAuditoria()])
      .then(([dash, audit]) => {
        setDashboard(dash);
        setAuditoria(audit);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Falha ao carregar dashboard.'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <AuthGate requiredPermissions={['dashboard.visualizar']}>
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
            <section className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
              <MetricCard title="Próprios" value={dashboard.indicadores.totalUnidades} hint="cadastrados" icon={Building2} />
              <MetricCard title="Fiscalizações" value={dashboard.indicadores.fiscalizacoes} hint="registradas" icon={ClipboardCheck} />
              <MetricCard title="Não conformidades" value={dashboard.indicadores.naoConformidades} hint="em acompanhamento" icon={ShieldAlert} />
              <MetricCard title="OS abertas" value={dashboard.indicadores.ordensServico.abertas} hint="aguardando ação" icon={Wrench} />
              <MetricCard title="OS em execução" value={dashboard.indicadores.ordensServico.emExecucao} hint="em andamento" icon={Wrench} />
              <MetricCard title="Sync pendente" value={dashboard.indicadores.syncPendentes} hint="eventos offline" icon={DatabaseZap} />
            </section>

            <section className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Pendências por secretaria</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 pt-0">
                  {dashboard.pendenciasPorSecretaria.map((item) => (
                    <div key={item.id} className="rounded-2xl border border-zinc-200/80 bg-zinc-50/50 p-4">
                      <strong className="text-zinc-950">{item.sigla}</strong>
                      <span className="text-zinc-500"> — {item.nome}</span>
                      <p className="mt-1 text-sm text-zinc-500">
                        {item.ordensPendentes} OS pendentes · {item.fiscalizacoes} fiscalizações
                      </p>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Últimos eventos de auditoria</CardTitle>
                </CardHeader>
                <CardContent className="max-h-[520px] space-y-3 overflow-auto pt-0">
                  {auditoria.map((evento) => (
                    <div key={evento.id} className="rounded-2xl border border-zinc-200/80 p-3 text-sm">
                      <strong className="text-zinc-950">{evento.acao}</strong>
                      <span className="text-zinc-500"> em {evento.entidadeTipo}</span>
                      <p className="mt-1 text-zinc-500">
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
    </AuthGate>
  );
}
