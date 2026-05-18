import Link from 'next/link';
import { ArrowRight, ClipboardList, MapPin } from 'lucide-react';
import { UnidadeOperacional } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
    <Card>
      <CardHeader>
        <CardTitle>Próprios públicos</CardTitle>
        <CardDescription>{unidades.length} registro(s) na consulta atual.</CardDescription>
      </CardHeader>

      <CardContent className="space-y-3 pt-0">
        {unidades.map((unidade) => (
          <Link
            key={unidade.id}
            href={`/cco/unidades/${unidade.id}`}
            className="group block rounded-2xl border border-zinc-200/80 bg-zinc-50/40 p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-blue-200 hover:bg-white hover:shadow-md"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold text-zinc-950">{unidade.nome}</h3>
                  <StatusBadge situacao={unidade.situacao} />
                </div>
                <p className="mt-1 text-sm text-zinc-500">
                  {unidade.codigoPatrimonial} · {unidade.secretaria.sigla} · {unidade.tipo}
                </p>
              </div>
              <ArrowRight className="mt-1 h-5 w-5 shrink-0 text-zinc-300 transition group-hover:text-blue-600" />
            </div>

            <div className="mt-4 grid gap-2 text-sm text-zinc-600 md:grid-cols-2">
              <span className="flex items-center gap-2">
                <MapPin className="h-4 w-4 shrink-0 text-blue-600" />
                <span className="truncate">
                  {unidade.bairro ? `${unidade.bairro} · ` : ''}
                  {unidade.latitude !== null && unidade.longitude !== null
                    ? `${unidade.latitude.toFixed(5)}, ${unidade.longitude.toFixed(5)}`
                    : 'Sem localização'}
                </span>
              </span>
              <span className="flex items-center gap-2">
                <ClipboardList className="h-4 w-4 shrink-0 text-blue-600" />
                {unidade.totais.fiscalizacoes} fiscalização(ões) ·{' '}
                {unidade.pendencias.naoConformidadesAbertas + unidade.pendencias.ordensServicoAbertas}{' '}
                pendência(s)
              </span>
            </div>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}
