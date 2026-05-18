'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, RefreshCcw, Send } from 'lucide-react';
import { AuthGate } from '@/components/auth-gate';
import { ErrorState, LoadingState } from '@/components/ui-states';
import { listIntegracoesEventos, retrySyncFalhas, sendMockNotification } from '@/lib/api';
import { IntegracoesEventos } from '@/lib/types';

export default function IntegracoesPage() {
  const [eventos, setEventos] = useState<IntegracoesEventos | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    listIntegracoesEventos()
      .then(setEventos)
      .catch((err) => setError(err instanceof Error ? err.message : 'Falha ao carregar integrações.'))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    void load();
  }, []);

  async function retry() {
    setSuccess(null);
    const result = await retrySyncFalhas();
    setSuccess(`${result.reenfileirados} evento(s) reenfileirado(s).`);
    await load();
  }

  async function notify() {
    await sendMockNotification('teste-operacional', { origem: 'painel-integracoes' });
    setSuccess('Notificação mock registrada.');
    await load();
  }

  return (
    <AuthGate requiredPermissions={['auditoria.visualizar']}>
      <main className="gestop-shell p-4 md:p-6">
        <div className="mx-auto max-w-6xl">
          <Link href="/cco" className="mb-4 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700">
            <ArrowLeft className="h-4 w-4" /> CCO
          </Link>
          <header className="mb-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wide text-blue-700">Integrações e resiliência</p>
            <h1 className="mt-2 text-3xl font-bold text-slate-950">Eventos técnicos, notificações e sync</h1>
          </header>
          {error ? <ErrorState message={error} /> : null}
          {success ? <div className="mb-4 rounded-2xl border border-green-200 bg-green-50 p-4 text-sm font-semibold text-green-800">{success}</div> : null}
          {loading ? <LoadingState label="Carregando eventos técnicos..." /> : null}
          {eventos ? (
            <section className="grid gap-6 lg:grid-cols-2">
              <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-lg font-bold text-slate-950">Falhas de sincronização</h2>
                  <button onClick={retry} className="inline-flex items-center gap-2 rounded-xl bg-blue-700 px-3 py-2 text-sm font-bold text-white">
                    <RefreshCcw className="h-4 w-4" /> Retentar
                  </button>
                </div>
                <div className="space-y-3">
                  {eventos.syncFalhas.map((item) => (
                    <div key={item.id} className="rounded-2xl border border-slate-200 p-4 text-sm">
                      <strong>{item.status}</strong> · {item.clientEventId}
                      <p className="text-slate-600">{item.conflitoMotivo ?? 'Aguardando processamento'} · tentativas {item.tentativas}</p>
                    </div>
                  ))}
                  {eventos.syncFalhas.length === 0 ? <p className="text-sm text-slate-600">Nenhuma falha pendente.</p> : null}
                </div>
              </div>
              <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-lg font-bold text-slate-950">Notificações mock</h2>
                  <button onClick={notify} className="inline-flex items-center gap-2 rounded-xl bg-green-700 px-3 py-2 text-sm font-bold text-white">
                    <Send className="h-4 w-4" /> Enviar teste
                  </button>
                </div>
                <div className="space-y-3">
                  {eventos.auditoriaIntegracoes.map((item) => (
                    <div key={item.id} className="rounded-2xl border border-slate-200 p-4 text-sm">
                      <strong>{item.entidadeTipo}</strong> · {item.acao}
                      <p className="text-slate-600">{new Date(item.createdAt).toLocaleString('pt-BR')}</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          ) : null}
        </div>
      </main>
    </AuthGate>
  );
}
