'use client';

import { useEffect, useMemo, useState } from 'react';
import { Activity, AlertTriangle, Building2, ClipboardCheck, DatabaseZap } from 'lucide-react';
import { getOpcoesFiltroUnidades, getResumoOperacional, getUnidades } from '@/lib/api';
import {
  OperacionalResumo,
  UnidadeFilters,
  UnidadeFiltroOpcoes,
  UnidadeOperacional,
} from '@/lib/types';
import { MetricCard } from '@/components/metric-card';
import { OperationalMap } from '@/components/operational-map';
import { UnidadeFiltersPanel } from '@/components/unidade-filters';
import { UnidadeList } from '@/components/unidade-list';
import { ErrorState, LoadingState } from '@/components/ui-states';
import { PageShell } from '@/components/layout/page-shell';
import { Badge } from '@/components/ui/badge';
import { MetricSkeleton } from '@/components/ui/skeleton';

export default function CcoPage() {
  const [filters, setFilters] = useState<UnidadeFilters>({});
  const [resumo, setResumo] = useState<OperacionalResumo | null>(null);
  const [opcoesFiltro, setOpcoesFiltro] = useState<UnidadeFiltroOpcoes | null>(null);
  const [unidades, setUnidades] = useState<UnidadeOperacional[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bootLoading, setBootLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function loadStaticData() {
      try {
        const [nextResumo, nextOpcoes] = await Promise.all([getResumoOperacional(), getOpcoesFiltroUnidades()]);

        if (!active) return;
        setResumo(nextResumo);
        setOpcoesFiltro(nextOpcoes);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Erro inesperado ao carregar a CCO.');
      } finally {
        if (active) setBootLoading(false);
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
      <PageShell
        kicker="Central de Controle Operacional"
        icon={Activity}
        title="Visão operacional dos próprios públicos"
        description="Consulta georreferenciada para validar localização, situação operacional, fiscalizações e pendências das unidades cadastradas."
        action={<Badge variant="success">RBAC ativo</Badge>}
      >
        <section className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {bootLoading
            ? Array.from({ length: 4 }).map((_, index) => <MetricSkeleton key={index} />)
            : metricas.map((metrica) => <MetricCard key={metrica.title} {...metrica} />)}
        </section>

        <div className="mb-6">
          <UnidadeFiltersPanel filters={filters} opcoes={opcoesFiltro} onChange={setFilters} />
        </div>

        {error ? <div className="mb-6"><ErrorState message={error} /></div> : null}

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
          <OperationalMap unidades={unidades} />
          {loading && unidades.length === 0 ? (
            <LoadingState label="Carregando próprios..." />
          ) : (
            <UnidadeList unidades={unidades} />
          )}
        </div>
      </PageShell>
  );
}
