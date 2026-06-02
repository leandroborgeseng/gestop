'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  AlertTriangle,
  Building2,
  CalendarClock,
  ClipboardList,
  MapPin,
  UserRound,
  Wrench,
} from 'lucide-react';
import { getUnidadeDetalhe } from '@/lib/api';
import { UnidadeDetalhe } from '@/lib/types';
import { PageShell } from '@/components/layout/page-shell';
import { TipBanner } from '@/components/help/tip-banner';
import { MetricCard } from '@/components/metric-card';
import { StatusBadge } from '@/components/status-badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { ErrorState, LoadingState } from '@/components/ui-states';

export default function UnidadeDetalhePage() {
  const params = useParams<{ id: string }>();
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
    <PageShell
      kicker="Próprio público"
      title={unidade?.nome ?? 'Detalhe do próprio'}
      description={unidade ? `${unidade.tipo} · ${unidade.secretaria.sigla}` : 'Carregando informações da unidade'}
      icon={Building2}
      backHref="/cco"
    >
      <TipBanner id="unidade-detalhe">
        Visão completa do patrimônio: fiscalizações, não conformidades e ordens de serviço vinculadas a este próprio.
      </TipBanner>

      {error ? <ErrorState message={error} /> : null}
      {loading ? <LoadingState label="Carregando detalhe do próprio..." /> : null}
      {!loading && unidade ? <UnidadeDetalheView unidade={unidade} /> : null}
    </PageShell>
  );
}

function UnidadeDetalheView({ unidade }: { unidade: UnidadeDetalhe }) {
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
        <MetricCard icon={ClipboardList} title="Fiscalizações" value={unidade.totais.fiscalizacoes} hint="registradas" />
        <MetricCard
          icon={AlertTriangle}
          title="Não conformidades"
          value={unidade.pendencias.naoConformidadesAbertas}
          hint="abertas"
          deltaTone={unidade.pendencias.naoConformidadesAbertas > 0 ? 'warn' : undefined}
        />
        <MetricCard icon={Wrench} title="Ordens de serviço" value={unidade.pendencias.ordensServicoAbertas} hint="ativas" />
      </section>

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
                  Usadas na validação do raio de check-in em campo.
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
        <Panel title="Últimas fiscalizações">
          {unidade.ultimasFiscalizacoes.length === 0 ? (
            <p className="text-[13px] text-[var(--ink-3)]">Nenhuma fiscalização registrada.</p>
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

        <Panel title="Pendências e ordens relacionadas">
          <div className="space-y-3">
            {unidade.pendenciasDetalhadas.naoConformidades.length === 0 &&
            unidade.pendenciasDetalhadas.ordensServico.length === 0 ? (
              <p className="text-[13px] text-[var(--ink-3)]">Nenhuma pendência ativa para este próprio.</p>
            ) : null}

            {unidade.pendenciasDetalhadas.naoConformidades.map((item) => (
              <div key={item.id} className="rounded-[var(--r-md)] border border-[var(--warn-bd)] bg-[var(--warn-bg)] p-4">
                <Chip variant="warning" className="mb-2">
                  {item.severidade} · {item.status}
                </Chip>
                <p className="text-[14px] font-semibold text-[var(--ink)]">
                  {item.item.codigo} — {item.item.titulo}
                </p>
                <p className="mt-1 text-[13px] text-[var(--ink-2)]">{item.descricao}</p>
              </div>
            ))}

            {unidade.pendenciasDetalhadas.ordensServico.map((ordem) => (
              <div key={ordem.id} className="rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--brand-soft)] p-4">
                <Chip variant="brand" className="mb-2">
                  {ordem.codigo} · {ordem.status} · {ordem.prioridade}
                </Chip>
                <p className="text-[14px] font-semibold text-[var(--ink)]">{ordem.titulo}</p>
                <p className="mt-1 text-[13px] text-[var(--ink-3)]">
                  Responsável: {ordem.responsavel?.nome ?? 'não atribuído'}
                </p>
              </div>
            ))}
          </div>
        </Panel>
      </section>
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
