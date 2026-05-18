'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, BarChart3 } from 'lucide-react';
import { AuthGate } from '@/components/auth-gate';
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
      <main className="gestop-shell p-4 md:p-6">
        <div className="mx-auto max-w-7xl">
          <Link href="/cco" className="mb-4 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700">
            <ArrowLeft className="h-4 w-4" /> CCO
          </Link>
          <header className="mb-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-blue-700"><BarChart3 className="h-4 w-4" />Monitoramento</p>
            <h1 className="mt-2 text-3xl font-bold text-slate-950">Dashboard operacional e auditoria</h1>
          </header>
          {error ? <ErrorState message={error} /> : null}
          {loading ? <LoadingState label="Carregando indicadores..." /> : null}
          {dashboard ? (
            <>
              <section className="mb-6 grid gap-4 md:grid-cols-3 xl:grid-cols-6">
                <Metric label="Próprios" value={dashboard.indicadores.totalUnidades} />
                <Metric label="Fiscalizações" value={dashboard.indicadores.fiscalizacoes} />
                <Metric label="Não conformidades" value={dashboard.indicadores.naoConformidades} />
                <Metric label="OS abertas" value={dashboard.indicadores.ordensServico.abertas} />
                <Metric label="OS em execução" value={dashboard.indicadores.ordensServico.emExecucao} />
                <Metric label="Sync pendente" value={dashboard.indicadores.syncPendentes} />
              </section>
              <section className="grid gap-6 lg:grid-cols-2">
                <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                  <h2 className="mb-4 text-lg font-bold text-slate-950">Pendências por secretaria</h2>
                  <div className="space-y-3">
                    {dashboard.pendenciasPorSecretaria.map((item) => (
                      <div key={item.id} className="rounded-2xl border border-slate-200 p-4">
                        <strong>{item.sigla}</strong> - {item.nome}
                        <p className="text-sm text-slate-600">{item.ordensPendentes} OS pendentes · {item.fiscalizacoes} fiscalizações</p>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                  <h2 className="mb-4 text-lg font-bold text-slate-950">Últimos eventos de auditoria</h2>
                  <div className="max-h-[520px] space-y-3 overflow-auto">
                    {auditoria.map((evento) => (
                      <div key={evento.id} className="rounded-2xl border border-slate-200 p-3 text-sm">
                        <strong>{evento.acao}</strong> em {evento.entidadeTipo}
                        <p className="text-slate-600">{evento.usuario?.nome ?? 'Sistema'} · {new Date(evento.createdAt).toLocaleString('pt-BR')}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            </>
          ) : null}
        </div>
      </main>
    </AuthGate>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-sm text-slate-600">{label}</p>
      <strong className="mt-2 block text-3xl text-slate-950">{value}</strong>
    </div>
  );
}
