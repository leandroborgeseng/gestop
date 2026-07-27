'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  AlertTriangle,
  Building2,
  CalendarClock,
  ClipboardList,
  Link2,
  MapPin,
  UserRound,
  Megaphone,
  CheckCircle2,
} from 'lucide-react';
import { RequirePermissions } from '@/components/auth/require-permissions';
import {
  baixarNaoConformidade,
  getUnidadeDetalhe,
  listChamadosParaVincularNc,
  vincularChamadoNc,
} from '@/lib/api';
import { chamadoTitulo } from '@/lib/chamado-geo';
import { useSafeBackHref } from '@/lib/use-safe-back-href';
import { UnidadeDetalhe } from '@/lib/types';
import { PageShell } from '@/components/layout/page-shell';
import { UnidadeAvulsoActions } from '@/components/operacional/unidade-avulso-actions';
import { TipBanner } from '@/components/help/tip-banner';
import { MetricCard } from '@/components/metric-card';
import { StatusBadge } from '@/components/status-badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet } from '@/components/ui/sheet';
import { useSnackbar } from '@/components/ui/snackbar';
import { ZoomableAuthenticatedImage } from '@/components/ui/zoomable-authenticated-image';
import { ErrorState, LoadingState } from '@/components/ui-states';
import { resolveStorageApiPath } from '@/lib/storage-url';
import { cn } from '@/lib/cn';

type NcItem = UnidadeDetalhe['pendenciasDetalhadas']['naoConformidades'][number];

const SITUACAO_LABEL: Record<NonNullable<NcItem['situacaoVisual']>, string> = {
  ABERTA: 'Aberta (sem chamado)',
  VINCULADA_EM_ANDAMENTO: 'Vinculada — chamado em andamento',
  RESOLVIDA_CHAMADO: 'Resolvida por chamado',
  BAIXADA_MANUAL: 'Baixada manualmente',
  ENCERRADA: 'Encerrada',
};

const SITUACAO_CHIP: Record<NonNullable<NcItem['situacaoVisual']>, 'warning' | 'brand' | 'success' | 'default' | 'danger'> = {
  ABERTA: 'warning',
  VINCULADA_EM_ANDAMENTO: 'brand',
  RESOLVIDA_CHAMADO: 'success',
  BAIXADA_MANUAL: 'default',
  ENCERRADA: 'default',
};

export default function UnidadeDetalhePage() {
  const params = useParams<{ id: string }>();
  const backHref = useSafeBackHref('/cco');
  const [unidade, setUnidade] = useState<UnidadeDetalhe | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!params.id) return;

    let active = true;
    setLoading(true);
    setError(null);

    getUnidadeDetalhe(params.id)
      .then((data) => {
        if (!active) return;
        setUnidade(data);
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Erro inesperado ao carregar próprio.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [params.id]);

  return (
    <RequirePermissions permissions={['dashboard.visualizar']}>
      <PageShell
      kicker="Próprio público"
      title={unidade?.nome ?? 'Detalhe do próprio'}
      description={unidade ? `${unidade.tipo} · ${unidade.secretaria.sigla}` : 'Carregando informações da unidade'}
      icon={Building2}
      backHref={backHref}
    >
      <TipBanner id="unidade-detalhe">
        Visão completa do patrimônio: vistorias, não conformidades e chamados vinculados a este próprio.
      </TipBanner>

      {error ? <ErrorState message={error} /> : null}
      {loading ? <LoadingState label="Carregando detalhe do próprio..." /> : null}
      {!loading && unidade ? (
        <UnidadeDetalheView
          unidade={unidade}
          onRefresh={() =>
            getUnidadeDetalhe(params.id).then(setUnidade).catch(() => undefined)
          }
        />
      ) : null}
    </PageShell>
    </RequirePermissions>
  );
}

function UnidadeDetalheView({ unidade, onRefresh }: { unidade: UnidadeDetalhe; onRefresh: () => void }) {
  const snackbar = useSnackbar();
  const [vincularNc, setVincularNc] = useState<NcItem | null>(null);
  const [baixaNc, setBaixaNc] = useState<NcItem | null>(null);
  const [baixaMotivo, setBaixaMotivo] = useState('');
  const [saving, setSaving] = useState(false);
  const [chamadoSearch, setChamadoSearch] = useState('');
  const [chamadosOpcoes, setChamadosOpcoes] = useState<
    Array<{
      id: string;
      codigo: string;
      titulo: string | null;
      descricao: string;
      status: string;
      prioridade: string;
      createdAt: string;
      tipoChamado?: { id: string; nome: string } | null;
    }>
  >([]);
  const [loadingChamados, setLoadingChamados] = useState(false);

  const ncs = unidade.pendenciasDetalhadas.naoConformidades;
  const ncsAbertas = useMemo(() => ncs.filter((nc) => nc.pendenteAtiva !== false && (nc.situacaoVisual === 'ABERTA' || nc.situacaoVisual === 'VINCULADA_EM_ANDAMENTO' || (!nc.situacaoVisual && nc.status !== 'RESOLVIDA' && nc.status !== 'BAIXADA_MANUAL' && nc.status !== 'CANCELADA'))), [ncs]);

  useEffect(() => {
    if (!vincularNc) return;
    let active = true;
    setLoadingChamados(true);
    const timer = window.setTimeout(() => {
      listChamadosParaVincularNc(unidade.id, { search: chamadoSearch || undefined })
        .then((data) => {
          if (!active) return;
          setChamadosOpcoes(data.items);
        })
        .catch(() => {
          if (!active) return;
          setChamadosOpcoes([]);
        })
        .finally(() => {
          if (active) setLoadingChamados(false);
        });
    }, 250);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [vincularNc, unidade.id, chamadoSearch]);

  async function handleVincular(chamadoId: string) {
    if (!vincularNc) return;
    setSaving(true);
    try {
      await vincularChamadoNc(vincularNc.id, chamadoId);
      snackbar.show('Chamado vinculado à não conformidade.', 'success');
      setVincularNc(null);
      onRefresh();
    } catch (err) {
      snackbar.show(err instanceof Error ? err.message : 'Falha ao vincular chamado.', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleBaixa() {
    if (!baixaNc) return;
    if (!baixaMotivo.trim()) {
      snackbar.show('Informe a justificativa da baixa.', 'error');
      return;
    }
    setSaving(true);
    try {
      await baixarNaoConformidade(baixaNc.id, baixaMotivo.trim());
      snackbar.show('Não conformidade baixada.', 'success');
      setBaixaNc(null);
      setBaixaMotivo('');
      onRefresh();
    } catch (err) {
      snackbar.show(err instanceof Error ? err.message : 'Falha ao dar baixa.', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card elevation={1}>
        <CardContent className="p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <Chip variant="brand">{unidade.codigoPatrimonial}</Chip>
                <StatusBadge situacao={unidade.situacao} />
              </div>
              <h1 className="mt-3 text-[20px] font-bold text-[var(--ink)]">{unidade.nome}</h1>
              <p className="mt-2 text-[14px] text-[var(--ink-3)]">
                {unidade.tipo} · {unidade.secretaria.sigla} — {unidade.secretaria.nome}
              </p>
              <UnidadeAvulsoActions
                className="mt-4"
                unidadeId={unidade.id}
                unidadeNome={unidade.nome}
                onSuccess={onRefresh}
                size="md"
              />
            </div>
            <div className="rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--surface-2)] px-4 py-3">
              <p className="text-[11px] font-bold tracking-wide text-[var(--ink-3)] uppercase">Raio de validação</p>
              <strong className="mono mt-1 block text-[22px] font-semibold text-[var(--ink)]">
                {unidade.raioValidacaoMetros} m
              </strong>
            </div>
          </div>
        </CardContent>
      </Card>

      <section className="grid gap-4 sm:grid-cols-3">
        <MetricCard icon={ClipboardList} title="Vistorias" value={unidade.totais.fiscalizacoes} hint="registradas" />
        <MetricCard
          icon={AlertTriangle}
          title="Não conformidades"
          value={unidade.pendencias.naoConformidadesAbertas}
          hint="pendências ativas"
          deltaTone={unidade.pendencias.naoConformidadesAbertas > 0 ? 'warn' : undefined}
        />
        <MetricCard icon={Megaphone} title="Chamados" value={unidade.pendencias.chamadosAbertos} hint="abertos" />
      </section>

      {unidade.pendencias.semVistoria && unidade.pendencias.vistoriaAtrasada ? (
        <Card elevation={1} className="border-[var(--warn)]/30 bg-[var(--warn-bg)]">
          <CardContent className="py-4">
            <p className="text-[13px] font-semibold text-[var(--warn)]">Vistoria programada atrasada</p>
            <p className="mt-1 text-[13px] text-[var(--ink-2)]">
              {unidade.pendencias.vistoriaAtrasada.checklistNome}
              {' · '}
              prevista para{' '}
              {new Date(unidade.pendencias.vistoriaAtrasada.proximaChecagemEm).toLocaleDateString('pt-BR')}
            </p>
          </CardContent>
        </Card>
      ) : null}

      <section className="grid gap-6 lg:grid-cols-2">
        <Card elevation={1}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-[var(--ink)]">
              <Building2 className="h-5 w-5 text-[var(--brand)]" />
              Dados cadastrais
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <dl className="grid gap-4 sm:grid-cols-2">
              <Info label="Endereço" value={unidade.endereco} />
              <Info label="Bairro" value={unidade.bairro ?? 'Não informado'} />
              <Info label="CEP" value={unidade.cep ?? 'Não informado'} />
              <Info label="Secretaria" value={`${unidade.secretaria.sigla} — ${unidade.secretaria.nome}`} />
              <Info label="Responsável" value={unidade.secretaria.responsavelNome ?? 'Não informado'} />
              <Info label="E-mail" value={unidade.secretaria.responsavelEmail ?? 'Não informado'} />
            </dl>
          </CardContent>
        </Card>

        <Card elevation={1}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-[var(--ink)]">
              <MapPin className="h-5 w-5 text-[var(--brand)]" />
              Localização
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {unidade.latitude !== null && unidade.longitude !== null ? (
              <div className="rounded-[var(--r-md)] border border-[var(--brand-soft)] bg-[var(--brand-soft)] p-5">
                <p className="text-[12px] font-semibold text-[var(--brand-hover)]">Coordenadas cadastradas</p>
                <p className="mono mt-2 text-[16px] font-semibold text-[var(--ink)]">
                  {unidade.latitude.toFixed(6)}, {unidade.longitude.toFixed(6)}
                </p>
                <p className="mt-3 text-[13px] text-[var(--ink-3)]">
                  Usadas na validação do raio de check-in na vistoria.
                </p>
              </div>
            ) : (
              <div className="rounded-[var(--r-md)] border border-[var(--warn-bd)] bg-[var(--warn-bg)] p-5 text-[13px] text-[var(--warn)]">
                Este próprio ainda não possui localização cadastrada.
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <Panel title="Últimas vistorias">
          {unidade.ultimasFiscalizacoes.length === 0 ? (
            <p className="text-[13px] text-[var(--ink-3)]">Nenhuma vistoria registrada.</p>
          ) : (
            <div className="space-y-2">
              {unidade.ultimasFiscalizacoes.map((fiscalizacao) => (
                <div
                  key={fiscalizacao.id}
                  className="rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--surface-2)] p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[14px] font-semibold text-[var(--ink)]">
                        {fiscalizacao.checklistVersao.checklist.nome} v{fiscalizacao.checklistVersao.versao}
                      </p>
                      <p className="mt-1 text-[13px] text-[var(--ink-3)]">
                        {fiscalizacao.status} · {fiscalizacao.origem}
                      </p>
                    </div>
                    <CalendarClock className="h-5 w-5 shrink-0 text-[var(--ink-4)]" />
                  </div>
                  <p className="mt-3 flex items-center gap-2 text-[13px] text-[var(--ink-3)]">
                    <UserRound className="h-4 w-4" />
                    {fiscalizacao.agente.nome}
                  </p>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Chamados relacionados">
          <div className="space-y-3">
            {unidade.pendenciasDetalhadas.chamados.length === 0 ? (
              <p className="text-[13px] text-[var(--ink-3)]">Nenhum chamado aberto para este próprio.</p>
            ) : (
              unidade.pendenciasDetalhadas.chamados.map((chamado) => (
                <div key={chamado.id} className="rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--brand-soft)] p-4">
                  <Chip variant="brand" className="mb-2">
                    {chamado.codigo} · {chamado.status} · {chamado.prioridade}
                  </Chip>
                  <p className="text-[14px] font-semibold text-[var(--ink)]">{chamadoTitulo(chamado)}</p>
                  <p className="mt-1 text-[13px] text-[var(--ink-3)]">
                    Responsável: {chamado.responsavel?.nome ?? 'não atribuído'}
                  </p>
                </div>
              ))
            )}
          </div>
        </Panel>
      </section>

      <Card elevation={1}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-[var(--ink)]">
            <AlertTriangle className="h-5 w-5 text-[var(--warn)]" />
            Não conformidades
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 pt-0">
          <p className="text-[13px] text-[var(--ink-3)]">
            NC aberta sem chamado e NC vinculada a chamado em andamento contam como pendência ativa no CCO.
            Baixadas manualmente ou resolvidas por chamado permanecem no histórico.
            {ncsAbertas.length > 0 ? ` · ${ncsAbertas.length} pendente(s) ativa(s).` : ''}
          </p>

          {ncs.length === 0 ? (
            <p className="text-[13px] text-[var(--ink-3)]">Nenhuma não conformidade registrada.</p>
          ) : (
            ncs.map((item) => {
              const situacao = item.situacaoVisual ?? (item.chamado ? 'VINCULADA_EM_ANDAMENTO' : 'ABERTA');
              const podeAgir = situacao === 'ABERTA';
              const respostaTexto =
                item.resposta?.valorTexto ??
                (item.resposta?.valorBooleano != null
                  ? item.resposta.valorBooleano
                    ? 'Sim'
                    : 'Não'
                  : null) ??
                (item.resposta?.valorNumero != null ? String(item.resposta.valorNumero) : null) ??
                item.resposta?.conformidade ??
                '—';

              return (
                <div
                  key={item.id}
                  className={cn(
                    'rounded-[var(--r-md)] border p-4',
                    situacao === 'ABERTA' && 'border-[var(--warn-bd)] bg-[var(--warn-bg)]',
                    situacao === 'VINCULADA_EM_ANDAMENTO' && 'border-[var(--brand)]/30 bg-[var(--brand-soft)]',
                    situacao === 'RESOLVIDA_CHAMADO' && 'border-[var(--ok-bd)] bg-[var(--ok-bg)]',
                    (situacao === 'BAIXADA_MANUAL' || situacao === 'ENCERRADA') &&
                      'border-[var(--line)] bg-[var(--surface-2)] opacity-90',
                  )}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Chip variant={SITUACAO_CHIP[situacao]}>{SITUACAO_LABEL[situacao]}</Chip>
                    <Chip>{item.severidade}</Chip>
                  </div>
                  <p className="mt-2 text-[14px] font-semibold text-[var(--ink)]">
                    {item.item.codigo} — {item.item.titulo}
                  </p>
                  <dl className="mt-2 grid gap-1.5 text-[12px] text-[var(--ink-3)] sm:grid-cols-2">
                    <div>
                      <dt className="font-semibold uppercase tracking-wide">Data vistoria</dt>
                      <dd>
                        {item.dataVistoria
                          ? new Date(item.dataVistoria).toLocaleString('pt-BR')
                          : new Date(item.registradaEm).toLocaleString('pt-BR')}
                      </dd>
                    </div>
                    <div>
                      <dt className="font-semibold uppercase tracking-wide">Checklist</dt>
                      <dd>
                        {item.checklist
                          ? `${item.checklist.nome} v${item.checklist.versao}`
                          : '—'}
                      </dd>
                    </div>
                    <div>
                      <dt className="font-semibold uppercase tracking-wide">Resposta</dt>
                      <dd>{respostaTexto}</dd>
                    </div>
                    <div>
                      <dt className="font-semibold uppercase tracking-wide">Usuário</dt>
                      <dd>{item.registradaPor?.nome ?? '—'}</dd>
                    </div>
                  </dl>
                  {(item.resposta?.comentario || item.descricao) ? (
                    <p className="mt-2 text-[13px] text-[var(--ink-2)]">
                      {item.resposta?.comentario || item.descricao}
                    </p>
                  ) : null}

                  {item.evidencias && item.evidencias.length > 0 ? (
                    <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
                      {item.evidencias.map((ev, index) => (
                        <ZoomableAuthenticatedImage
                          key={ev.id}
                          src={resolveStorageApiPath(ev.url) ?? ev.url}
                          alt={`Evidência ${index + 1}`}
                          className="aspect-square w-full rounded-[var(--r-sm)] object-cover"
                        />
                      ))}
                    </div>
                  ) : null}

                  {item.chamado ? (
                    <p className="mt-2 text-[13px]">
                      Chamado vinculado:{' '}
                      <Link
                        href={`/chamados?search=${encodeURIComponent(item.chamado.codigo)}`}
                        className="font-semibold text-[var(--brand)] hover:underline"
                      >
                        {item.chamado.codigo}
                      </Link>{' '}
                      · {item.chamado.status}
                    </p>
                  ) : situacao === 'ABERTA' ? (
                    <p className="mt-2 text-[12px] font-medium text-[var(--warn)]">
                      Pendente sem chamado — conta como pendência ativa no CCO.
                    </p>
                  ) : null}

                  {item.motivoBaixa ? (
                    <p className="mt-2 text-[12px] text-[var(--ink-3)]">
                      Baixa: {item.motivoBaixa}
                      {item.baixadaPor ? ` · ${item.baixadaPor.nome}` : ''}
                      {item.baixadaEm ? ` · ${new Date(item.baixadaEm).toLocaleString('pt-BR')}` : ''}
                    </p>
                  ) : null}

                  {podeAgir ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button type="button" variant="outlined" size="sm" onClick={() => setVincularNc(item)}>
                        <Link2 className="mr-1.5 h-3.5 w-3.5" />
                        Vincular chamado
                      </Button>
                      <Button type="button" variant="outlined" size="sm" onClick={() => { setBaixaNc(item); setBaixaMotivo(''); }}>
                        <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                        Dar baixa
                      </Button>
                    </div>
                  ) : null}
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      <Sheet
        open={Boolean(vincularNc)}
        onClose={() => setVincularNc(null)}
        title="Vincular chamado à NC"
      >
        <div className="space-y-3">
          <p className="text-[13px] text-[var(--ink-3)]">
            Selecione um chamado existente deste próprio (sem NC vinculada).
          </p>
          <Input
            value={chamadoSearch}
            onChange={(e) => setChamadoSearch(e.target.value)}
            placeholder="Buscar por número, tipo ou descrição"
          />
          {loadingChamados ? <LoadingState label="Buscando chamados..." /> : null}
          {!loadingChamados && chamadosOpcoes.length === 0 ? (
            <p className="text-[13px] text-[var(--ink-3)]">Nenhum chamado disponível para vínculo.</p>
          ) : null}
          <div className="max-h-[50dvh] space-y-2 overflow-y-auto">
            {chamadosOpcoes.map((chamado) => (
              <button
                key={chamado.id}
                type="button"
                disabled={saving}
                onClick={() => void handleVincular(chamado.id)}
                className="w-full rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--surface-2)] p-3 text-left transition hover:border-[var(--brand)]"
              >
                <p className="text-[13px] font-semibold text-[var(--ink)]">
                  {chamado.codigo} · {chamado.status} · {chamado.tipoChamado?.nome ?? 'Sem tipo'}
                </p>
                <p className="mt-1 line-clamp-2 text-[12px] text-[var(--ink-3)]">
                  {chamado.titulo || chamado.descricao}
                </p>
              </button>
            ))}
          </div>
        </div>
      </Sheet>

      <Sheet
        open={Boolean(baixaNc)}
        onClose={() => setBaixaNc(null)}
        title="Dar baixa na NC"
        footer={
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outlined" onClick={() => setBaixaNc(null)} disabled={saving}>
              Cancelar
            </Button>
            <Button type="button" variant="filled" onClick={() => void handleBaixa()} disabled={saving}>
              Confirmar baixa
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <p className="text-[13px] text-[var(--ink-3)]">
            A NC deixa de ser pendência ativa no CCO, mas permanece no histórico/auditoria. Justificativa obrigatória.
          </p>
          <textarea
            value={baixaMotivo}
            onChange={(e) => setBaixaMotivo(e.target.value)}
            placeholder="Justificativa da baixa"
            className="min-h-28 w-full rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--surface)] p-3 text-[14px] focus:border-[var(--brand)] focus:outline-none"
          />
        </div>
      </Sheet>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] font-bold tracking-wide text-[var(--ink-3)] uppercase">{label}</dt>
      <dd className="mt-1 text-[14px] font-medium text-[var(--ink)]">{value}</dd>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card elevation={1}>
      <CardHeader>
        <CardTitle className="text-[var(--ink)]">{title}</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">{children}</CardContent>
    </Card>
  );
}
