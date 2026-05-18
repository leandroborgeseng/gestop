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
import { AuthGate } from '@/components/auth-gate';
import { PageShell } from '@/components/layout/page-shell';
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
    <AuthGate>
      <PageShell
        title={unidade?.nome ?? 'Detalhe do próprio'}
        description={unidade ? `${unidade.tipo} · ${unidade.secretaria.sigla}` : 'Carregando informações da unidade'}
        icon={Building2}
        backHref="/cco"
      >
        {error ? <ErrorState message={error} /> : null}
        {loading ? <LoadingState label="Carregando detalhe do próprio..." /> : null}
        {!loading && unidade ? <UnidadeDetalheView unidade={unidade} /> : null}
      </PageShell>
    </AuthGate>
  );
}

function UnidadeDetalheView({ unidade }: { unidade: UnidadeDetalhe }) {
  return (
    <div className="space-y-6">
      <Card elevation={2}>
        <CardContent className="p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <Chip variant="brand">{unidade.codigoPatrimonial}</Chip>
                <StatusBadge situacao={unidade.situacao} />
              </div>
              <h1 className="md-headline-md mt-3 text-[var(--md-on-surface)]">{unidade.nome}</h1>
              <p className="md-body-md mt-2 text-[var(--md-on-surface-variant)]">
                {unidade.tipo} · {unidade.secretaria.sigla} — {unidade.secretaria.nome}
              </p>
            </div>
            <div className="rounded-[var(--md-shape-md)] bg-[var(--md-surface-container-low)] px-4 py-3 md-body-md text-[var(--md-on-surface-variant)]">
              Raio de validação
              <strong className="md-headline-md mt-0.5 block text-[var(--md-on-surface)]">
                {unidade.raioValidacaoMetros} m
              </strong>
            </div>
          </div>
        </CardContent>
      </Card>

      <section className="grid gap-6 lg:grid-cols-2">
        <Card elevation={1}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-[var(--color-brand-primary)]" />
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
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-[var(--color-brand-primary)]" />
              Localização
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {unidade.latitude !== null && unidade.longitude !== null ? (
              <div className="rounded-[var(--md-shape-md)] bg-[var(--color-brand-primary-subtle)] p-5">
                <p className="md-label-lg text-[var(--color-brand-primary)]">Coordenadas cadastradas</p>
                <p className="md-headline-md mt-2 text-[var(--md-on-surface)]">
                  {unidade.latitude.toFixed(6)}, {unidade.longitude.toFixed(6)}
                </p>
                <p className="md-body-md mt-3 text-[var(--md-on-surface-variant)]">
                  Essas coordenadas serão usadas na validação do raio de check-in em campo.
                </p>
              </div>
            ) : (
              <div className="rounded-[var(--md-shape-md)] bg-amber-50 p-5 md-body-md text-amber-800">
                Este próprio ainda não possui localização cadastrada.
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <MetricCard icon={ClipboardList} title="Fiscalizações" value={unidade.totais.fiscalizacoes} hint="registradas para este próprio" />
        <MetricCard icon={AlertTriangle} title="Não conformidades" value={unidade.pendencias.naoConformidadesAbertas} hint="abertas ou em triagem" />
        <MetricCard icon={Wrench} title="Ordens de serviço" value={unidade.pendencias.ordensServicoAbertas} hint="ativas no momento" />
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <Panel title="Últimas fiscalizações">
          {unidade.ultimasFiscalizacoes.length === 0 ? (
            <p className="md-body-md text-[var(--md-on-surface-variant)]">Nenhuma fiscalização registrada.</p>
          ) : (
            <div className="space-y-2">
              {unidade.ultimasFiscalizacoes.map((fiscalizacao) => (
                <div
                  key={fiscalizacao.id}
                  className="rounded-[var(--md-shape-md)] bg-[var(--md-surface-container-low)] p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="md-title-md text-[var(--md-on-surface)]">
                        {fiscalizacao.checklistVersao.checklist.nome} v{fiscalizacao.checklistVersao.versao}
                      </p>
                      <p className="md-body-md mt-1 text-[var(--md-on-surface-variant)]">
                        {fiscalizacao.status} · {fiscalizacao.origem}
                      </p>
                    </div>
                    <CalendarClock className="h-5 w-5 text-[var(--md-outline)]" />
                  </div>
                  <p className="md-body-md mt-3 flex items-center gap-2 text-[var(--md-on-surface-variant)]">
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
              <p className="md-body-md text-[var(--md-on-surface-variant)]">Nenhuma pendência ativa para este próprio.</p>
            ) : null}

            {unidade.pendenciasDetalhadas.naoConformidades.map((item) => (
              <div key={item.id} className="rounded-[var(--md-shape-md)] bg-amber-50 p-4">
                <Chip variant="warning" className="mb-2">
                  {item.severidade} · {item.status}
                </Chip>
                <p className="md-title-md text-[var(--md-on-surface)]">
                  {item.item.codigo} — {item.item.titulo}
                </p>
                <p className="md-body-md mt-1 text-amber-900/80">{item.descricao}</p>
              </div>
            ))}

            {unidade.pendenciasDetalhadas.ordensServico.map((ordem) => (
              <div key={ordem.id} className="rounded-[var(--md-shape-md)] bg-[var(--color-brand-primary-subtle)] p-4">
                <Chip variant="brand" className="mb-2">
                  {ordem.codigo} · {ordem.status} · {ordem.prioridade}
                </Chip>
                <p className="md-title-md text-[var(--md-on-surface)]">{ordem.titulo}</p>
                <p className="md-body-md mt-1 text-[var(--md-on-surface-variant)]">
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
      <dt className="md-label-md text-[var(--md-on-surface-variant)]">{label}</dt>
      <dd className="md-body-md mt-1 font-medium text-[var(--md-on-surface)]">{value}</dd>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card elevation={1}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">{children}</CardContent>
    </Card>
  );
}
