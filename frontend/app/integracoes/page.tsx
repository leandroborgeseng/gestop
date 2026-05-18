'use client';

import { useEffect, useState } from 'react';
import { Plug, RefreshCcw, Send } from 'lucide-react';
import { AuthGate } from '@/components/auth-gate';
import { PageShell } from '@/components/layout/page-shell';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
      <PageShell
        kicker="Integrações e resiliência"
        icon={Plug}
        title="Eventos técnicos, notificações e sync"
        backHref="/cco"
      >
        {error ? <div className="mb-6"><ErrorState message={error} /></div> : null}
        {success ? <Alert variant="success" className="mb-4">{success}</Alert> : null}
        {loading ? <LoadingState label="Carregando eventos técnicos..." /> : null}

        {eventos ? (
          <section className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <CardTitle>Falhas de sincronização</CardTitle>
                <Button variant="brand" size="sm" onClick={() => void retry()}>
                  <RefreshCcw className="h-4 w-4" />
                  Retentar
                </Button>
              </CardHeader>
              <CardContent className="space-y-3 pt-0">
                {eventos.syncFalhas.map((item) => (
                  <div key={item.id} className="rounded-2xl border border-zinc-200/80 bg-zinc-50/50 p-4 text-sm">
                    <strong className="text-zinc-950">{item.status}</strong>
                    <span className="text-zinc-500"> · {item.clientEventId}</span>
                    <p className="mt-1 text-zinc-500">
                      {item.conflitoMotivo ?? 'Aguardando processamento'} · tentativas {item.tentativas}
                    </p>
                  </div>
                ))}
                {eventos.syncFalhas.length === 0 ? (
                  <p className="text-sm text-zinc-500">Nenhuma falha pendente.</p>
                ) : null}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <CardTitle>Notificações mock</CardTitle>
                <Button variant="secondary" size="sm" onClick={() => void notify()}>
                  <Send className="h-4 w-4" />
                  Enviar teste
                </Button>
              </CardHeader>
              <CardContent className="space-y-3 pt-0">
                {eventos.auditoriaIntegracoes.map((item) => (
                  <div key={item.id} className="rounded-2xl border border-zinc-200/80 p-4 text-sm">
                    <strong className="text-zinc-950">{item.entidadeTipo}</strong>
                    <span className="text-zinc-500"> · {item.acao}</span>
                    <p className="mt-1 text-zinc-500">{new Date(item.createdAt).toLocaleString('pt-BR')}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </section>
        ) : null}
      </PageShell>
    </AuthGate>
  );
}
