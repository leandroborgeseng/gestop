'use client';

import { useEffect, useState } from 'react';
import { Plug, RefreshCcw, Send } from 'lucide-react';
import { RequirePermissions } from '@/components/auth/require-permissions';
import { PageShell } from '@/components/layout/page-shell';
import { TipBanner } from '@/components/help/tip-banner';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useSnackbar } from '@/components/ui/snackbar';
import { ErrorState, LoadingState } from '@/components/ui-states';
import { listIntegracoesEventos, retrySyncFalhas, sendIntegrationNotification } from '@/lib/api';
import { IntegracoesEventos } from '@/lib/types';

export default function IntegracoesPage() {
  const snackbar = useSnackbar();
  const [eventos, setEventos] = useState<IntegracoesEventos | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<'retry' | 'notify' | null>(null);

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
    setActionLoading('retry');
    setError(null);
    setSuccess(null);
    try {
      const result = await retrySyncFalhas();
      const message = `${result.reenfileirados} evento(s) reenfileirado(s).`;
      setSuccess(message);
      snackbar.show(message, 'success');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao reenfileirar sync.');
    } finally {
      setActionLoading(null);
    }
  }

  async function notify() {
    setActionLoading('notify');
    setError(null);
    setSuccess(null);
    try {
      const result = await sendIntegrationNotification('teste-operacional', { origem: 'painel-integracoes' });
      const message = `Notificação enviada via ${result.adapter}${result.delivered ? '' : ' (falhou)'}.`;
      setSuccess(message);
      snackbar.show(message, result.delivered ? 'success' : 'warning');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao enviar notificação.');
    } finally {
      setActionLoading(null);
    }
  }

  return (
    <RequirePermissions permissions={['auditoria.visualizar']}>
      <PageShell
        kicker="Técnico"
        icon={Plug}
        title="Integrações"
        description="Webhooks, sincronização de campo e status dos serviços conectados."
        backHref="/cco"
      >
        <TipBanner id="integracoes-sync">
          Falhas de sync de campo aparecem aqui. Use Retentar para reenfileirar eventos pendentes ou envie uma notificação de teste.
        </TipBanner>

        {error ? <div className="mb-6"><ErrorState message={error} onRetry={() => void load()} /></div> : null}
        {success ? <Alert variant="success" className="mb-4">{success}</Alert> : null}
        {loading ? <LoadingState label="Carregando eventos técnicos..." /> : null}

        {eventos ? (
          <>
            <div className="mb-6 grid gap-3 sm:grid-cols-2">
              <div className="rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--surface)] p-4">
                <div className="flex items-center justify-between">
                  <Badge variant={eventos.syncFalhas.length === 0 ? 'success' : 'warning'}>
                    {eventos.syncFalhas.length === 0 ? 'Sync operacional' : 'Sync com falhas'}
                  </Badge>
                  <span className="mono text-[12px] text-[var(--ink-3)]">{eventos.syncFalhas.length} falha(s)</span>
                </div>
                <p className="mt-2 text-[13px] text-[var(--ink-3)]">Fila de sincronização mobile</p>
              </div>
              <div className="rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--surface)] p-4">
                <div className="flex items-center justify-between">
                  <Badge variant="info">Notificações</Badge>
                  <span className="mono text-[12px] text-[var(--ink-3)]">{eventos.auditoriaIntegracoes.length} evento(s)</span>
                </div>
                <p className="mt-2 text-[13px] text-[var(--ink-3)]">Webhook e alertas operacionais</p>
              </div>
            </div>

          <section className="grid gap-6 lg:grid-cols-2">
            <Card elevation={1}>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <CardTitle>Falhas de sincronização</CardTitle>
                <Button variant="filled" size="sm" disabled={actionLoading !== null} onClick={() => void retry()}>
                  <RefreshCcw className="h-4 w-4" />
                  {actionLoading === 'retry' ? 'Retentando...' : 'Retentar'}
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
                <CardTitle>Notificações</CardTitle>
                <Button variant="tonal" size="sm" disabled={actionLoading !== null} onClick={() => void notify()}>
                  <Send className="h-4 w-4" />
                  {actionLoading === 'notify' ? 'Enviando...' : 'Enviar teste'}
                </Button>
              </CardHeader>
              <CardContent className="space-y-2 pt-0">
                {eventos.auditoriaIntegracoes.length === 0 ? (
                  <p className="md-body-md py-4 text-[var(--md-on-surface-variant)]">Nenhuma notificação registrada.</p>
                ) : null}
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
          </>
        ) : null}
      </PageShell>
    </RequirePermissions>
  );
}
