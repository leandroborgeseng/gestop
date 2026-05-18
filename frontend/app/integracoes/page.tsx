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
        {error ? <div className="mb-6"><ErrorState message={error} onRetry={() => void load()} /></div> : null}
        {success ? <Alert variant="success" className="mb-4">{success}</Alert> : null}
        {loading ? <LoadingState label="Carregando eventos técnicos..." /> : null}

        {eventos ? (
          <section className="grid gap-6 lg:grid-cols-2">
            <Card elevation={1}>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <CardTitle>Falhas de sincronização</CardTitle>
                <Button variant="filled" size="sm" onClick={() => void retry()}>
                  <RefreshCcw className="h-4 w-4" />
                  Retentar
                </Button>
              </CardHeader>
              <CardContent className="space-y-2 pt-0">
                {eventos.syncFalhas.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-[var(--md-shape-md)] bg-[var(--md-surface-container-low)] p-4 md-body-md"
                  >
                    <strong className="md-title-md text-[var(--md-on-surface)]">{item.status}</strong>
                    <span className="text-[var(--md-on-surface-variant)]"> · {item.clientEventId}</span>
                    <p className="mt-1 text-[var(--md-on-surface-variant)]">
                      {item.conflitoMotivo ?? 'Aguardando processamento'} · tentativas {item.tentativas}
                    </p>
                  </div>
                ))}
                {eventos.syncFalhas.length === 0 ? (
                  <p className="md-body-md py-4 text-[var(--md-on-surface-variant)]">Nenhuma falha pendente.</p>
                ) : null}
              </CardContent>
            </Card>

            <Card elevation={1}>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <CardTitle>Notificações mock</CardTitle>
                <Button variant="tonal" size="sm" onClick={() => void notify()}>
                  <Send className="h-4 w-4" />
                  Enviar teste
                </Button>
              </CardHeader>
              <CardContent className="space-y-2 pt-0">
                {eventos.auditoriaIntegracoes.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-[var(--md-shape-md)] border border-[var(--md-outline-variant)] p-4 md-body-md"
                  >
                    <strong className="md-title-md text-[var(--md-on-surface)]">{item.entidadeTipo}</strong>
                    <span className="text-[var(--md-on-surface-variant)]"> · {item.acao}</span>
                    <p className="mt-1 text-[var(--md-on-surface-variant)]">
                      {new Date(item.createdAt).toLocaleString('pt-BR')}
                    </p>
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
