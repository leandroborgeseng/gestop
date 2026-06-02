'use client';

import { useState } from 'react';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { dispararAlertasOperacionais, getVapidPublicKey, subscribeWebPush } from '@/lib/api';
import { enableWebPush, registerServiceWorker } from '@/lib/pwa';

export function PushNotificationsPanel() {
  const [loading, setLoading] = useState<'push' | 'alertas' | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function ativarPush() {
    setLoading('push');
    setError(null);
    setMessage(null);
    try {
      registerServiceWorker();
      const { publicKey, enabled } = await getVapidPublicKey();
      if (!enabled || !publicKey) {
        throw new Error('Web Push não configurado no servidor (VAPID).');
      }
      const subscription = await enableWebPush(publicKey);
      if (!subscription.endpoint || !subscription.keys) {
        throw new Error('Falha ao registrar subscription.');
      }
      await subscribeWebPush(subscription);
      setMessage('Notificações push ativadas para este dispositivo.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao ativar push.');
    } finally {
      setLoading(null);
    }
  }

  async function dispararAlertas() {
    setLoading('alertas');
    setError(null);
    setMessage(null);
    try {
      const result = await dispararAlertasOperacionais();
      if (result.enviados === 0) {
        setMessage('Nenhum alerta operacional pendente no momento.');
      } else {
        setMessage(
          `Alertas enviados: ${result.enviados} item(ns). Push: ${result.push}. Webhook: ${result.webhook ? 'ok' : 'mock/falha'}.`,
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao disparar alertas.');
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="mb-6 rounded-[var(--r-card)] border border-[var(--line)] bg-[var(--surface)] p-4 shadow-[var(--sh-sm)]">
      <p className="flex items-center gap-2 text-[14px] font-semibold text-[var(--ink)]">
        <Bell className="h-4 w-4 text-[var(--brand)]" />
        Notificações operacionais
      </p>
      <p className="mt-1 text-[13px] text-[var(--ink-3)]">
        Receba alertas de OS atrasadas e chamados parados no navegador. Gestores podem disparar manualmente.
      </p>
      {error ? <Alert variant="error" className="mt-3">{error}</Alert> : null}
      {message ? <Alert variant="success" className="mt-3">{message}</Alert> : null}
      <div className="mt-3 flex flex-wrap gap-2">
        <Button variant="filled" size="sm" disabled={loading === 'push'} onClick={() => void ativarPush()}>
          {loading === 'push' ? 'Ativando...' : 'Ativar push neste dispositivo'}
        </Button>
        <Button variant="tonal" size="sm" disabled={loading === 'alertas'} onClick={() => void dispararAlertas()}>
          {loading === 'alertas' ? 'Enviando...' : 'Disparar alertas agora'}
        </Button>
      </div>
    </div>
  );
}
