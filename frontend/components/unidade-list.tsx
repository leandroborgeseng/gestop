import Link from 'next/link';
import { ArrowRight, ClipboardList, MapPin } from 'lucide-react';
import { UnidadeOperacional } from '@/lib/types';
import { StatusBadge } from './status-badge';
import { EmptyState } from './ui-states';

export function UnidadeList({ unidades }: { unidades: UnidadeOperacional[] }) {
  if (unidades.length === 0) {
    return (
      <EmptyState
        title="Nenhum próprio encontrado"
        description="Ajuste os filtros ou cadastre novos próprios públicos na administração."
      />
    );
  }

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-950">Próprios públicos</h2>
          <p className="text-sm text-slate-600">{unidades.length} registro(s) na consulta atual.</p>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200">
        <div className="max-h-[620px] divide-y divide-slate-100 overflow-auto">
          {unidades.map((unidade) => (
            <Link
              key={unidade.id}
              href={`/cco/unidades/${unidade.id}`}
              className="block bg-white p-4 transition hover:bg-blue-50/60"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold text-slate-950">{unidade.nome}</h3>
                    <StatusBadge situacao={unidade.situacao} />
                  </div>
                  <p className="mt-1 text-sm text-slate-600">
                    {unidade.codigoPatrimonial} · {unidade.secretaria.sigla} · {unidade.tipo}
                  </p>
                </div>
                <ArrowRight className="mt-1 h-5 w-5 shrink-0 text-slate-400" />
              </div>

              <div className="mt-3 grid gap-2 text-sm text-slate-600 md:grid-cols-2">
                <span className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-blue-600" />
                  {unidade.bairro ? `${unidade.bairro} · ` : ''}
                  {unidade.latitude !== null && unidade.longitude !== null
                    ? `${unidade.latitude.toFixed(5)}, ${unidade.longitude.toFixed(5)}`
                    : 'Sem localização'}
                </span>
                <span className="flex items-center gap-2">
                  <ClipboardList className="h-4 w-4 text-blue-600" />
                  {unidade.totais.fiscalizacoes} fiscalização(ões) ·{' '}
                  {unidade.pendencias.naoConformidadesAbertas + unidade.pendencias.ordensServicoAbertas}{' '}
                  pendência(s)
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
