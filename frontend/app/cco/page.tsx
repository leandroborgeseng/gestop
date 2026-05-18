'use client';

import { useEffect, useMemo, useState } from 'react';
import { Activity, AlertTriangle, Building2, ClipboardCheck, DatabaseZap } from 'lucide-react';
import { getBairros, getResumoOperacional, getSecretarias, getUnidades } from '@/lib/api';
import {
  OperacionalResumo,
  SecretariaOption,
  UnidadeFilters,
  UnidadeOperacional,
} from '@/lib/types';
import { MetricCard } from '@/components/metric-card';
import { OperationalMap } from '@/components/operational-map';
import { UnidadeFiltersPanel } from '@/components/unidade-filters';
import { UnidadeList } from '@/components/unidade-list';
import { ErrorState, LoadingState } from '@/components/ui-states';
import { AuthGate } from '@/components/auth-gate';

export default function CcoPage() {
  const [filters, setFilters] = useState<UnidadeFilters>({});
  const [resumo, setResumo] = useState<OperacionalResumo | null>(null);
  const [secretarias, setSecretarias] = useState<SecretariaOption[]>([]);
  const [bairros, setBairros] = useState<string[]>([]);
  const [unidades, setUnidades] = useState<UnidadeOperacional[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadStaticData() {
      try {
        const [nextResumo, nextSecretarias, nextBairros] = await Promise.all([
          getResumoOperacional(),
          getSecretarias(),
          getBairros(),
        ]);

        if (!active) return;
        setResumo(nextResumo);
        setSecretarias(nextSecretarias);
        setBairros(nextBairros);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Erro inesperado ao carregar a CCO.');
      }
    }

    void loadStaticData();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    getUnidades(filters)
      .then((data) => {
        if (!active) return;
        setUnidades(data);
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Erro inesperado ao carregar próprios.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [filters]);

  const metricas = useMemo(
    () => [
      {
        title: 'Próprios públicos',
        value: resumo?.totalUnidades ?? 0,
        hint: `${resumo?.unidadesAtivas ?? 0} ativos`,
        icon: Building2,
      },
      {
        title: 'Fiscalizações',
        value: resumo?.fiscalizacoesConcluidas ?? 0,
        hint: 'concluídas no ambiente',
        icon: ClipboardCheck,
      },
      {
        title: 'Pendências',
        value: (resumo?.naoConformidadesAbertas ?? 0) + (resumo?.ordensServicoAbertas ?? 0),
        hint: 'não conformidades e OS abertas',
        icon: AlertTriangle,
      },
      {
        title: 'Sincronização',
        value: resumo?.eventosSyncPendentes ?? 0,
        hint: 'eventos pendentes ou em conflito',
        icon: DatabaseZap,
      },
    ],
    [resumo],
  );

  return (
    <AuthGate>
      <main className="gestop-shell p-4 md:p-6">
        <div className="mx-auto max-w-7xl">
          <header className="mb-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <span className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-bold uppercase tracking-wide text-blue-700">
                  <Activity className="h-3.5 w-3.5" />
                  Central de Controle Operacional
                </span>
                <h1 className="mt-3 text-3xl font-bold text-slate-950">Visão operacional dos próprios públicos</h1>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                  Consulta inicial para validar localização, situação operacional, fiscalizações e pendências das
                  unidades cadastradas no GestOP.
                </p>
              </div>
              <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
                Ambiente protegido
                <strong className="block text-slate-950">RBAC ativo</strong>
              </div>
            </div>
          </header>

          <section className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {metricas.map((metrica) => (
              <MetricCard key={metrica.title} {...metrica} />
            ))}
          </section>

          <div className="mb-6">
            <UnidadeFiltersPanel
              filters={filters}
              secretarias={secretarias}
              bairros={bairros}
              onChange={setFilters}
            />
          </div>

          {error ? <ErrorState message={error} /> : null}
          {loading ? (
            <LoadingState />
          ) : (
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(420px,0.65fr)]">
              <OperationalMap unidades={unidades} />
              <UnidadeList unidades={unidades} />
            </div>
          )}
        </div>
      </main>
    </AuthGate>
  );
}
