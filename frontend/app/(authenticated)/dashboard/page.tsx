'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  BarChart3,
  Building2,
  ClipboardCheck,
  DatabaseZap,
  MapPin,
  Megaphone,
  ShieldAlert,
} from 'lucide-react';
import { RequirePermissions } from '@/components/auth/require-permissions';
import { useSessionUser } from '@/components/auth/session-context';
import { PageShell } from '@/components/layout/page-shell';
import { TipBanner } from '@/components/help/tip-banner';
import { MetricCard } from '@/components/metric-card';
import { DashboardAnalysisCard } from '@/components/dashboard/dashboard-analysis-card';
import { PushNotificationsPanel } from '@/components/dashboard/push-notifications-panel';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { ErrorState, LoadingState } from '@/components/ui-states';
import {
  getAlertasOperacionais,
  getDashboard,
  getOpcoesFiltroUnidades,
  getSecretarias,
  listAuditoria,
} from '@/lib/api';
import { CHAMADO_STATUS_META } from '@/lib/chamado-status';
import { hasChamadosGerenciar } from '@/lib/navigation';
import { useSafeBackHref } from '@/lib/use-safe-back-href';
import type {
  AlertasOperacionais,
  AuditoriaEvento,
  DashboardData,
  SecretariaOption,
  UnidadeFiltroOpcoes,
} from '@/lib/types';

const PRIORIDADES = [
  { value: 'BAIXA', label: 'Baixa' },
  { value: 'MEDIA', label: 'Média' },
  { value: 'ALTA', label: 'Alta' },
  { value: 'URGENTE', label: 'Urgente' },
] as const;

function currentMonthBounds() {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { from: iso(from), to: iso(to) };
}

export default function DashboardPage() {
  const backHref = useSafeBackHref('/cco');
  const user = useSessionUser();
  const canChamados = hasChamadosGerenciar(user?.permissoes ?? []);
  const month = useMemo(() => currentMonthBounds(), []);

  const [secretarias, setSecretarias] = useState<SecretariaOption[]>([]);
  const [opcoes, setOpcoes] = useState<UnidadeFiltroOpcoes | null>(null);
  const [from, setFrom] = useState(month.from);
  const [to, setTo] = useState(month.to);
  const [secretariaId, setSecretariaId] = useState('');
  const [equipeId, setEquipeId] = useState('');
  const [cargo, setCargo] = useState('');
  const [tipoChamadoId, setTipoChamadoId] = useState('');
  const [prioridade, setPrioridade] = useState('');
  const [status, setStatus] = useState('');

  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [alertas, setAlertas] = useState<AlertasOperacionais | null>(null);
  const [auditoria, setAuditoria] = useState<AuditoriaEvento[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const buildParams = useCallback(() => {
    const params: Record<string, string> = {};
    if (from) params.from = from;
    if (to) params.to = to;
    if (secretariaId) params.secretariaId = secretariaId;
    if (equipeId) params.equipeId = equipeId;
    if (cargo.trim()) params.cargo = cargo.trim();
    if (tipoChamadoId) params.tipoChamadoId = tipoChamadoId;
    if (prioridade) params.prioridade = prioridade;
    if (status) params.status = status;
    return params;
  }, [from, to, secretariaId, equipeId, cargo, tipoChamadoId, prioridade, status]);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [dash, alerts] = await Promise.all([getDashboard(buildParams()), getAlertasOperacionais()]);
      setDashboard(dash);
      setAlertas(alerts);
      try {
        setAuditoria(await listAuditoria());
      } catch {
        setAuditoria([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar dashboard.');
    } finally {
      setLoading(false);
    }
  }, [buildParams]);

  useEffect(() => {
    getSecretarias().then(setSecretarias).catch(() => setSecretarias([]));
    getOpcoesFiltroUnidades()
      .then(setOpcoes)
      .catch(() => setOpcoes(null));
  }, []);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const cargosDisponiveis = useMemo(() => {
    const fromAnalise = dashboard?.analise?.produtividadePorCargo.map((item) => item.label) ?? [];
    return [...new Set(fromAnalise.filter((item) => item && item !== 'Sem cargo'))].sort((a, b) =>
      a.localeCompare(b, 'pt-BR'),
    );
  }, [dashboard?.analise?.produtividadePorCargo]);

  const hasAlertas =
    alertas &&
    (alertas.resumo.chamadosAtrasados > 0 ||
      alertas.resumo.chamadosSemTriagem > 0 ||
      alertas.resumo.syncFalhas > 0 ||
      alertas.resumo.chamadosUrgentes > 0);

  const analise = dashboard?.analise;

  return (
    <RequirePermissions permissions={['dashboard.visualizar']}>
      <PageShell
        kicker="Monitoramento"
        icon={BarChart3}
        title="Dashboard operacional"
        description="Indicadores filtráveis, análise de produtividade dos chamados e acompanhamento geral do sistema."
        backHref={backHref}
      >
        <TipBanner id="dashboard-alertas">
          Os filtros do topo recalculam os cards e a análise de chamados. As seções finais de pendências e auditoria
          permanecem sem filtro.
        </TipBanner>

        {error ? (
          <div className="mb-6">
            <ErrorState message={error} />
          </div>
        ) : null}

        <Card elevation={1} className="mb-6">
          <CardContent className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-4">
            <Field label="De">
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </Field>
            <Field label="Até">
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </Field>
            <Field label="Secretaria">
              <Select value={secretariaId} onChange={(e) => setSecretariaId(e.target.value)}>
                <option value="">Todas</option>
                {secretarias.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.sigla} — {item.nome}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Equipe">
              <Select value={equipeId} onChange={(e) => setEquipeId(e.target.value)}>
                <option value="">Todas</option>
                <option value="sem-equipe">Sem equipe atribuída</option>
                {(opcoes?.equipes ?? []).map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.nome}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Cargo">
              <Select value={cargo} onChange={(e) => setCargo(e.target.value)}>
                <option value="">Todos</option>
                {cargosDisponiveis.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Tipo de chamado">
              <Select value={tipoChamadoId} onChange={(e) => setTipoChamadoId(e.target.value)}>
                <option value="">Todos</option>
                {(opcoes?.tiposChamado ?? []).map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.nome}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Prioridade">
              <Select value={prioridade} onChange={(e) => setPrioridade(e.target.value)}>
                <option value="">Todas</option>
                {PRIORIDADES.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Status">
              <Select value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="">Todos</option>
                {Object.entries(CHAMADO_STATUS_META).map(([value, meta]) => (
                  <option key={value} value={value}>
                    {meta.label}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="flex items-end gap-2 sm:col-span-2 xl:col-span-4">
              <Button variant="filled" size="sm" onClick={() => void loadDashboard()} disabled={loading}>
                {loading ? 'Atualizando...' : 'Aplicar filtros'}
              </Button>
              <Button
                variant="outlined"
                size="sm"
                onClick={() => {
                  setFrom(month.from);
                  setTo(month.to);
                  setSecretariaId('');
                  setEquipeId('');
                  setCargo('');
                  setTipoChamadoId('');
                  setPrioridade('');
                  setStatus('');
                }}
              >
                Limpar
              </Button>
              <p className="ml-auto text-[12px] text-[var(--ink-3)]">
                Período padrão: mês atual · produtividade usa data de conclusão
              </p>
            </div>
          </CardContent>
        </Card>

        {loading && !dashboard ? <LoadingState label="Carregando indicadores..." /> : null}

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
                  {alertas!.resumo.chamadosAtrasados} chamados atrasados · {alertas!.resumo.chamadosSemTriagem} sem
                  triagem · {alertas!.resumo.chamadosUrgentes} urgentes · {alertas!.resumo.syncFalhas} falhas de sync
                </p>
                {canChamados ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Link
                      href="/chamados"
                      className="inline-flex h-8 items-center rounded-[var(--r-md)] bg-[var(--brand)] px-3 text-[12.5px] font-semibold text-white shadow-[var(--sh-sm)] hover:bg-[var(--brand-hover)]"
                    >
                      Ver chamados
                    </Link>
                  </div>
                ) : null}
              </Alert>
            ) : null}

            <section className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard title="Próprios" value={dashboard.indicadores.totalUnidades} hint="cadastrados" icon={Building2} />
              <MetricCard title="Vistorias" value={dashboard.indicadores.fiscalizacoes} hint="registradas" icon={ClipboardCheck} />
              <MetricCard
                title="Não conformidades"
                value={dashboard.indicadores.naoConformidades}
                hint="em acompanhamento"
                icon={ShieldAlert}
                deltaTone={dashboard.indicadores.naoConformidades > 0 ? 'warn' : undefined}
              />
              <MetricCard
                title="Chamados abertos"
                value={dashboard.indicadores.chamados.abertos}
                hint="triagem + fila operacional"
                icon={Megaphone}
                deltaTone={dashboard.indicadores.chamados.abertos > 0 ? 'warn' : undefined}
              />
              <MetricCard title="Em atendimento" value={dashboard.indicadores.chamados.emAtendimento} hint="backoffice" icon={Megaphone} />
              <MetricCard
                title="Em execução"
                value={dashboard.indicadores.chamados.emExecucao}
                hint="equipe em campo"
                icon={MapPin}
                deltaTone={dashboard.indicadores.chamados.emExecucao > 0 ? 'warn' : undefined}
              />
              <MetricCard
                title="Impedidos"
                value={dashboard.indicadores.chamados.impedidos}
                hint="bloqueados"
                icon={AlertTriangle}
                deltaTone={dashboard.indicadores.chamados.impedidos > 0 ? 'warn' : undefined}
              />
              <MetricCard
                title="Concluídos"
                value={dashboard.indicadores.chamados.concluidos}
                hint="no período filtrado"
                icon={ClipboardCheck}
              />
              <MetricCard
                title="Sync pendente"
                value={dashboard.indicadores.syncPendentes}
                hint="eventos offline"
                icon={DatabaseZap}
                deltaTone={dashboard.indicadores.syncPendentes > 0 ? 'warn' : undefined}
              />
            </section>

            <section className="mb-2">
              <h2 className="text-[15px] font-semibold text-[var(--ink)]">Análise de chamados</h2>
              <p className="mt-1 text-[13px] text-[var(--ink-3)]">
                Produtividade com base no log de conclusão · {analise?.totalConcluidosAnalisados ?? 0} chamado(s)
                concluído(s) no filtro
              </p>
            </section>

            <section className="mb-8 grid gap-4 lg:grid-cols-2">
              <DashboardAnalysisCard
                title="Produtividade por funcionário"
                hint="Participantes do evento de conclusão (equipe + externos)"
                items={analise?.produtividadePorFuncionario ?? []}
                emptyLabel="Sem funcionário"
              />
              <DashboardAnalysisCard
                title="Produtividade por equipe"
                hint="Equipe registrada na conclusão, não a atribuição atual"
                items={analise?.produtividadePorEquipe ?? []}
                emptyLabel="Sem equipe"
              />
              <DashboardAnalysisCard
                title="Produtividade por cargo"
                hint="Cargos dos participantes da execução"
                items={analise?.produtividadePorCargo ?? []}
                emptyLabel="Sem cargo"
              />
              <DashboardAnalysisCard
                title="Chamados por tipo"
                items={analise?.chamadosPorTipo ?? []}
                emptyLabel="Sem tipo"
              />
              <DashboardAnalysisCard
                title="Chamados por Secretaria"
                hint="Sigla da Secretaria responsável"
                items={analise?.chamadosPorSecretaria ?? []}
                emptyLabel="Sem Secretaria"
              />
            </section>

            <div className="mb-4 border-t border-[var(--line)] pt-6">
              <h2 className="text-[15px] font-semibold text-[var(--ink)]">Acompanhamento geral do sistema</h2>
              <p className="mt-1 text-[13px] text-[var(--ink-3)]">
                Informações gerais não filtradas — não sofrem impacto dos filtros aplicados acima.
              </p>
            </div>

            <section className="grid gap-6 lg:grid-cols-2">
              <Card elevation={1}>
                <CardHeader>
                  <CardTitle className="text-[var(--ink)]">Pendências por secretaria</CardTitle>
                </CardHeader>
                <CardContent className="max-h-[420px] space-y-2 overflow-y-auto pt-0">
                  {dashboard.pendenciasPorSecretaria.length === 0 ? (
                    <p className="py-4 text-[13px] text-[var(--ink-3)]">Nenhuma pendência registrada.</p>
                  ) : null}
                  {dashboard.pendenciasPorSecretaria.map((item) => (
                    <div key={item.id} className="rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--surface-2)] p-4">
                      <strong className="text-[14px] font-semibold text-[var(--ink)]">{item.sigla}</strong>
                      <span className="text-[13px] text-[var(--ink-3)]"> — {item.nome}</span>
                      <p className="mt-1 text-[13px] text-[var(--ink-3)]">
                        {item.chamadosPendentes} chamados pendentes · {item.fiscalizacoes} vistorias
                      </p>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card elevation={1}>
                <CardHeader>
                  <CardTitle className="text-[var(--ink)]">Últimos eventos de auditoria</CardTitle>
                </CardHeader>
                <CardContent className="max-h-[420px] space-y-2 overflow-auto pt-0">
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
