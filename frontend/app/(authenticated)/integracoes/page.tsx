'use client';

import { useEffect, useState } from 'react';
import { ChevronDown, Plug, RefreshCcw, Send, Webhook } from 'lucide-react';
import { RequirePermissions } from '@/components/auth/require-permissions';
import { useSessionUser } from '@/components/auth/session-context';
import { PageShell } from '@/components/layout/page-shell';
import { TipBanner } from '@/components/help/tip-banner';
import { MetricCard } from '@/components/metric-card';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { useSnackbar } from '@/components/ui/snackbar';
import { ErrorState, LoadingState } from '@/components/ui-states';
import {
  ignoreSyncFalha,
  listIntegracoesEventos,
  retrySyncFalha,
  retrySyncFalhas,
  sendIntegrationNotification,
} from '@/lib/api';
import { hasIntegracoesExecutarAccess } from '@/lib/permissions-matrix';
import { useSafeBackHref } from '@/lib/use-safe-back-href';
import { IntegracoesEventos } from '@/lib/types';

const PAGE = 50;

export default function IntegracoesPage() {
  const backHref = useSafeBackHref('/cco');
  const snackbar = useSnackbar();
  const session = useSessionUser();
  const canExec = hasIntegracoesExecutarAccess(session?.permissoes ?? [], session);
  const [eventos, setEventos] = useState<IntegracoesEventos | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [falhasStatus, setFalhasStatus] = useState('PENDENTE');
  const [falhasSearch, setFalhasSearch] = useState('');
  const [notificacoesSearch, setNotificacoesSearch] = useState('');
  const [falhasLimit, setFalhasLimit] = useState(PAGE);
  const [notificacoesLimit, setNotificacoesLimit] = useState(PAGE);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  async function load(next?: { falhasLimit?: number; notificacoesLimit?: number }) {
    setLoading(true);
    try {
      const data = await listIntegracoesEventos({
        falhasStatus,
        falhasSearch: falhasSearch || undefined,
        falhasLimit: next?.falhasLimit ?? falhasLimit,
        falhasOffset: 0,
        notificacoesSearch: notificacoesSearch || undefined,
        notificacoesLimit: next?.notificacoesLimit ?? notificacoesLimit,
        notificacoesOffset: 0,
      });
      setEventos(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar integrações.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [falhasStatus]);

  async function retryAll() {
    setActionLoading('retry-all');
    try {
      const result = await retrySyncFalhas();
      snackbar.show(`${result.reenfileirados} evento(s) reenfileirado(s).`, 'success');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao reenfileirar sync.');
    } finally {
      setActionLoading(null);
    }
  }

  async function retryOne(id: string) {
    setActionLoading(id);
    try {
      await retrySyncFalha(id);
      snackbar.show('Retentativa enviada.', 'success');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao retentar.');
    } finally {
      setActionLoading(null);
    }
  }

  async function ignoreOne(id: string) {
    const justificativa = window.prompt('Justificativa para ignorar esta falha (opcional):') ?? undefined;
    if (justificativa === undefined) return;
    if (!window.confirm('Ignorar esta falha? Ela sairá da lista de pendentes, mas permanece registrada.')) return;
    setActionLoading(`ignorar-${id}`);
    try {
      await ignoreSyncFalha(id, justificativa);
      snackbar.show('Falha marcada como ignorada.', 'success');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao ignorar.');
    } finally {
      setActionLoading(null);
    }
  }

  async function notify() {
    setActionLoading('notify');
    try {
      const result = await sendIntegrationNotification('teste-operacional', { origem: 'painel-integracoes' });
      snackbar.show(`Notificação enviada via ${result.adapter}${result.delivered ? '' : ' (falhou)'}.`, result.delivered ? 'success' : 'warning');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao enviar notificação.');
    } finally {
      setActionLoading(null);
    }
  }

  return (
    <RequirePermissions
      permissions={[
        'auditoria.visualizar',
        'matriz.integracoes._tela.visualizar',
        'matriz.integracoes.monitorar.visualizar',
      ]}
      match="any"
    >
      <PageShell
        kicker="Técnico"
        icon={Plug}
        title="Integrações"
        description="Webhooks, sincronização de vistoria e status dos serviços conectados."
        backHref={backHref}
      >
        <TipBanner id="integracoes-sync">
          Falhas de sync de vistoria aparecem aqui. Use Retentar para reenfileirar eventos pendentes ou envie uma notificação de teste.
        </TipBanner>

        {error ? (
          <div className="mb-6">
            <ErrorState message={error} onRetry={() => void load()} />
          </div>
        ) : null}
        {loading && !eventos ? <LoadingState label="Carregando eventos técnicos..." /> : null}

        {eventos ? (
          <>
            <section className="mb-6 grid gap-3 sm:grid-cols-3">
              <MetricCard title="Pendentes" value={eventos.counts?.pendentes ?? eventos.syncFalhas.length} hint="sync pendentes" icon={RefreshCcw} deltaTone={(eventos.counts?.pendentes ?? 0) > 0 ? 'warn' : undefined} />
              <MetricCard title="Ignoradas" value={eventos.counts?.ignoradas ?? 0} hint="fora do contador" icon={RefreshCcw} />
              <MetricCard title="Notificações" value={eventos.notificacoesTotal ?? eventos.auditoriaIntegracoes.length} hint="eventos" icon={Webhook} />
            </section>

            <section className="grid gap-6 lg:grid-cols-2">
              <Card elevation={1} className="flex max-h-[620px] flex-col">
                <CardHeader className="flex-row flex-wrap items-center justify-between gap-2 space-y-0">
                  <CardTitle className="text-[var(--ink)]">Falhas de sincronização</CardTitle>
                  {canExec ? (
                    <Button variant="filled" size="sm" disabled={actionLoading !== null} onClick={() => void retryAll()}>
                      <RefreshCcw className="h-4 w-4" />
                      {actionLoading === 'retry-all' ? 'Retentando...' : 'Retentar'}
                    </Button>
                  ) : null}
                </CardHeader>
                <CardContent className="flex min-h-0 flex-1 flex-col gap-2 pt-0">
                  <div className="flex flex-wrap gap-2">
                    <Select value={falhasStatus} onChange={(event) => { setFalhasStatus(event.target.value); setFalhasLimit(PAGE); }} className="h-9 w-[160px]">
                      <option value="PENDENTE">Pendentes</option>
                      <option value="IGNORADA">Ignoradas</option>
                      <option value="RESOLVIDA">Resolvidas</option>
                      <option value="TODAS">Todas</option>
                    </Select>
                    <Input value={falhasSearch} onChange={(event) => setFalhasSearch(event.target.value)} placeholder="Buscar falha..." className="h-9 flex-1" onKeyDown={(event) => { if (event.key === 'Enter') void load(); }} />
                  </div>
                  <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
                    {eventos.syncFalhas.map((item) => {
                      const open = Boolean(expanded[item.id]);
                      const pendente = ['PENDENTE', 'FALHOU', 'CONFLITO', 'PROCESSANDO', 'IGNORADO'].includes(item.status);
                      return (
                        <div key={item.id} className="rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--surface-2)] p-3">
                          <button type="button" className="flex w-full items-start gap-2 text-left" onClick={() => setExpanded((current) => ({ ...current, [item.id]: !current[item.id] }))}>
                            <ChevronDown className={`mt-0.5 h-4 w-4 shrink-0 ${open ? 'rotate-180' : ''}`} />
                            <div className="min-w-0 flex-1">
                              <strong className="text-[14px] text-[var(--ink)]">{item.tipo ?? 'SYNC'} · {item.status}</strong>
                              <p className="text-[12px] text-[var(--ink-3)]">
                                {item.usuario?.nome ?? 'Usuário não identificado'} · {new Date(item.recebidoEm).toLocaleString('pt-BR')}
                              </p>
                              <p className="mt-1 text-[13px] text-[var(--ink-2)]">
                                {item.ultimoErro ?? item.conflitoMotivo ?? 'Aguardando processamento'} · tentativas {item.tentativas}
                              </p>
                            </div>
                          </button>
                          {open ? (
                            <div className="mt-2 space-y-1 border-t border-[var(--line)] pt-2 text-[12px] text-[var(--ink-3)]">
                              <p>ID: {item.id}</p>
                              <p>Evento cliente: {item.clientEventId}</p>
                              <p>Dispositivo: {item.deviceId}</p>
                              {item.entidadeId ? <p>Entidade: {item.entidadeId}</p> : null}
                              {item.justificativaIgnorar ? <p>Justificativa: {item.justificativaIgnorar}</p> : null}
                              {item.ignoradoPor ? <p>Ignorado por: {item.ignoradoPor.nome}</p> : null}
                              <pre className="overflow-x-auto rounded bg-[var(--surface)] p-2 text-[11px]">{JSON.stringify(item.payloadResumo ?? {}, null, 2)}</pre>
                            </div>
                          ) : null}
                          {canExec && pendente && item.status !== 'SINCRONIZADO' ? (
                            <div className="mt-2 flex flex-wrap gap-2">
                              <Button type="button" size="sm" variant="outlined" disabled={actionLoading !== null} onClick={() => void retryOne(item.id)}>
                                Retentar
                              </Button>
                              {item.status !== 'IGNORADO' ? (
                                <Button type="button" size="sm" variant="text" disabled={actionLoading !== null} onClick={() => void ignoreOne(item.id)}>
                                  Ignorar falha
                                </Button>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                    {eventos.syncFalhas.length === 0 ? <p className="py-4 text-[13px] text-[var(--ink-3)]">Nenhuma falha neste filtro.</p> : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {eventos.falhasHasMore ? (
                      <Button type="button" size="sm" variant="outlined" onClick={() => { const next = falhasLimit + PAGE; setFalhasLimit(next); void load({ falhasLimit: next }); }}>
                        Carregar mais
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      size="sm"
                      variant="text"
                      onClick={() => {
                        if ((eventos.falhasTotal ?? 0) > 300 && !window.confirm('Carregar todos pode deixar a tela mais lenta. Continuar?')) return;
                        const next = Math.max(eventos.falhasTotal ?? PAGE, PAGE);
                        setFalhasLimit(next);
                        void load({ falhasLimit: next });
                      }}
                    >
                      Carregar todos
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card elevation={1} className="flex max-h-[620px] flex-col">
                <CardHeader className="flex-row flex-wrap items-center justify-between gap-2 space-y-0">
                  <CardTitle className="text-[var(--ink)]">Notificações</CardTitle>
                  {canExec ? (
                    <Button variant="tonal" size="sm" disabled={actionLoading !== null} onClick={() => void notify()}>
                      <Send className="h-4 w-4" />
                      {actionLoading === 'notify' ? 'Enviando...' : 'Enviar teste'}
                    </Button>
                  ) : null}
                </CardHeader>
                <CardContent className="flex min-h-0 flex-1 flex-col gap-2 pt-0">
                  <Input value={notificacoesSearch} onChange={(event) => setNotificacoesSearch(event.target.value)} placeholder="Buscar notificação..." className="h-9" onKeyDown={(event) => { if (event.key === 'Enter') void load(); }} />
                  <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
                    {eventos.auditoriaIntegracoes.length === 0 ? (
                      <p className="py-4 text-[13px] text-[var(--ink-3)]">Nenhuma notificação registrada.</p>
                    ) : null}
                    {eventos.auditoriaIntegracoes.map((item) => {
                      const open = Boolean(expanded[`n-${item.id}`]);
                      return (
                        <div key={item.id} className="rounded-[var(--r-md)] border border-[var(--line)] p-3">
                          <button type="button" className="flex w-full items-start gap-2 text-left" onClick={() => setExpanded((current) => ({ ...current, [`n-${item.id}`]: !current[`n-${item.id}`] }))}>
                            <ChevronDown className={`mt-0.5 h-4 w-4 ${open ? 'rotate-180' : ''}`} />
                            <div>
                              <strong className="text-[14px]">{item.tipo ?? item.entidadeTipo} · {item.acao}</strong>
                              <p className="text-[12px] text-[var(--ink-3)]">
                                {item.usuario?.nome ?? 'Sistema'} · {new Date(item.createdAt).toLocaleString('pt-BR')}
                              </p>
                              <p className="text-[13px] text-[var(--ink-2)]">
                                {String(item.codigo ?? item.evento ?? item.entidadeId ?? 'Evento técnico')}
                              </p>
                            </div>
                          </button>
                          {open ? (
                            <pre className="mt-2 overflow-x-auto rounded bg-[var(--surface-2)] p-2 text-[11px]">{JSON.stringify(item.detalhes ?? item, null, 2)}</pre>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {eventos.notificacoesHasMore ? (
                      <Button type="button" size="sm" variant="outlined" onClick={() => { const next = notificacoesLimit + PAGE; setNotificacoesLimit(next); void load({ notificacoesLimit: next }); }}>
                        Carregar mais
                      </Button>
                    ) : null}
                    <Button type="button" size="sm" variant="text" onClick={() => {
                      if ((eventos.notificacoesTotal ?? 0) > 300 && !window.confirm('Carregar todos pode deixar a tela mais lenta. Continuar?')) return;
                      const next = Math.max(eventos.notificacoesTotal ?? PAGE, PAGE);
                      setNotificacoesLimit(next);
                      void load({ notificacoesLimit: next });
                    }}>
                      Carregar todos
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </section>
          </>
        ) : null}
      </PageShell>
    </RequirePermissions>
  );
}
