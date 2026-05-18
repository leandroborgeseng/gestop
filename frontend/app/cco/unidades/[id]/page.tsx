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
  type LucideIcon,
} from 'lucide-react';
import { getUnidadeDetalhe } from '@/lib/api';
import { UnidadeDetalhe } from '@/lib/types';
import { AuthGate } from '@/components/auth-gate';
import { PageShell } from '@/components/layout/page-shell';
import { StatusBadge } from '@/components/status-badge';
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
      <header className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold uppercase tracking-wide text-blue-700">
                {unidade.codigoPatrimonial}
              </span>
              <StatusBadge situacao={unidade.situacao} />
            </div>
            <h1 className="mt-3 text-3xl font-bold text-slate-950">{unidade.nome}</h1>
            <p className="mt-2 text-sm text-slate-600">
              {unidade.tipo} · {unidade.secretaria.sigla} - {unidade.secretaria.nome}
            </p>
          </div>
          <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
            Raio de validação
            <strong className="block text-2xl text-slate-950">{unidade.raioValidacaoMetros} m</strong>
          </div>
        </div>
      </header>

      <section className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-slate-950">
            <Building2 className="h-5 w-5 text-blue-700" />
            Dados cadastrais
          </h2>
          <dl className="grid gap-4 text-sm md:grid-cols-2">
            <Info label="Endereço" value={unidade.endereco} />
            <Info label="Bairro" value={unidade.bairro ?? 'Não informado'} />
            <Info label="CEP" value={unidade.cep ?? 'Não informado'} />
            <Info label="Secretaria" value={`${unidade.secretaria.sigla} - ${unidade.secretaria.nome}`} />
            <Info label="Responsável" value={unidade.secretaria.responsavelNome ?? 'Não informado'} />
            <Info label="E-mail" value={unidade.secretaria.responsavelEmail ?? 'Não informado'} />
          </dl>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-slate-950">
            <MapPin className="h-5 w-5 text-blue-700" />
            Localização
          </h2>
          {unidade.latitude !== null && unidade.longitude !== null ? (
            <div className="rounded-2xl border border-blue-100 bg-blue-50 p-5">
              <p className="text-sm font-semibold text-slate-700">Coordenadas cadastradas</p>
              <p className="mt-2 text-2xl font-bold text-slate-950">
                {unidade.latitude.toFixed(6)}, {unidade.longitude.toFixed(6)}
              </p>
              <p className="mt-3 text-sm text-slate-600">
                Essas coordenadas serão usadas na validação do raio de check-in em campo.
              </p>
            </div>
          ) : (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
              Este próprio ainda não possui localização cadastrada.
            </div>
          )}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <ResumoCard
          icon={ClipboardList}
          label="Fiscalizações"
          value={unidade.totais.fiscalizacoes}
          hint="registradas para este próprio"
        />
        <ResumoCard
          icon={AlertTriangle}
          label="Não conformidades"
          value={unidade.pendencias.naoConformidadesAbertas}
          hint="abertas ou em triagem"
        />
        <ResumoCard
          icon={Wrench}
          label="Ordens de serviço"
          value={unidade.pendencias.ordensServicoAbertas}
          hint="ativas no momento"
        />
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <Panel title="Últimas fiscalizações">
          {unidade.ultimasFiscalizacoes.length === 0 ? (
            <p className="text-sm text-slate-600">Nenhuma fiscalização registrada.</p>
          ) : (
            <div className="space-y-3">
              {unidade.ultimasFiscalizacoes.map((fiscalizacao) => (
                <div key={fiscalizacao.id} className="rounded-2xl border border-slate-200 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-950">
                        {fiscalizacao.checklistVersao.checklist.nome} v{fiscalizacao.checklistVersao.versao}
                      </p>
                      <p className="mt-1 text-sm text-slate-600">
                        {fiscalizacao.status} · {fiscalizacao.origem}
                      </p>
                    </div>
                    <CalendarClock className="h-5 w-5 text-slate-400" />
                  </div>
                  <p className="mt-3 flex items-center gap-2 text-sm text-slate-600">
                    <UserRound className="h-4 w-4" />
                    {fiscalizacao.agente.nome}
                  </p>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Pendências e ordens relacionadas">
          <div className="space-y-4">
            {unidade.pendenciasDetalhadas.naoConformidades.length === 0 &&
            unidade.pendenciasDetalhadas.ordensServico.length === 0 ? (
              <p className="text-sm text-slate-600">Nenhuma pendência ativa para este próprio.</p>
            ) : null}

            {unidade.pendenciasDetalhadas.naoConformidades.map((item) => (
              <div key={item.id} className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-amber-700">
                  {item.severidade} · {item.status}
                </p>
                <p className="mt-1 font-semibold text-slate-950">{item.item.codigo} - {item.item.titulo}</p>
                <p className="mt-1 text-sm text-slate-700">{item.descricao}</p>
              </div>
            ))}

            {unidade.pendenciasDetalhadas.ordensServico.map((ordem) => (
              <div key={ordem.id} className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-blue-700">
                  {ordem.codigo} · {ordem.status} · {ordem.prioridade}
                </p>
                <p className="mt-1 font-semibold text-slate-950">{ordem.titulo}</p>
                <p className="mt-1 text-sm text-slate-700">
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
      <dt className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-1 font-medium text-slate-900">{value}</dd>
    </div>
  );
}

function ResumoCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  hint: string;
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <Icon className="h-5 w-5 text-blue-700" />
      <p className="mt-3 text-sm font-medium text-slate-600">{label}</p>
      <strong className="mt-1 block text-3xl font-bold text-slate-950">{value}</strong>
      <p className="mt-1 text-xs text-slate-500">{hint}</p>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="mb-4 text-lg font-bold text-slate-950">{title}</h2>
      {children}
    </section>
  );
}
