import Link from 'next/link';
import { ArrowRight, Building2, ClipboardList, LocateFixed, Mail, UserRound } from 'lucide-react';
import { UnidadeOperacional } from '@/lib/types';
import { formatUnidadeTipo } from '@/lib/unidade-tipo';
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
    <Card elevation={1}>
      <CardHeader>
        <CardTitle>Próprios públicos</CardTitle>
        <CardDescription>{unidades.length} registro(s) na consulta atual.</CardDescription>
      </CardHeader>

      <CardContent className="space-y-2 pt-0">
        {unidades.map((unidade) => (
          <Link
            key={unidade.id}
            href={`/cco/unidades/${unidade.id}`}
            className="group flex flex-col gap-3 rounded-[var(--md-shape-md)] border border-transparent bg-[var(--md-surface-container-low)] p-4 transition-all duration-[var(--md-duration-short)] hover:border-[color-mix(in_srgb,var(--color-brand-primary)_20%,transparent)] hover:bg-[var(--md-surface)] hover:shadow-[var(--md-elevation-1)] active:scale-[0.99]"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="md-title-md text-[var(--md-on-surface)]">{unidade.nome}</h3>
                  <StatusBadge situacao={unidade.situacao} />
                </div>
                <p className="md-body-md mt-1 text-[var(--md-on-surface-variant)]">
                  {unidade.codigoPatrimonial} · {unidade.secretaria.sigla} · {formatUnidadeTipo(unidade.tipo)}
                </p>
              </div>
              <ArrowRight className="mt-1 h-5 w-5 shrink-0 text-[var(--md-outline)] transition group-hover:text-[var(--color-brand-primary)]" />
            </div>

            <div className="grid gap-2 md-body-md text-[var(--md-on-surface-variant)] md:grid-cols-2">
              <span className="flex items-center gap-2 md:col-span-2">
                <Building2 className="h-4 w-4 shrink-0 text-[var(--color-brand-primary)]" />
                <span className="truncate">
                  {unidade.endereco}
                  {unidade.bairro ? ` · ${unidade.bairro}` : ''}
                </span>
              </span>
              {unidade.secretaria.responsavelNome ? (
                <span className="flex items-center gap-2">
                  <UserRound className="h-4 w-4 shrink-0 text-[var(--color-brand-primary)]" />
                  <span className="truncate">{unidade.secretaria.responsavelNome}</span>
                </span>
              ) : null}
              {unidade.secretaria.responsavelEmail ? (
                <span className="flex items-center gap-2">
                  <Mail className="h-4 w-4 shrink-0 text-[var(--color-brand-primary)]" />
                  <span className="truncate">{unidade.secretaria.responsavelEmail}</span>
                </span>
              ) : null}
              <span className="flex items-center gap-2">
                <LocateFixed className="h-4 w-4 shrink-0 text-[var(--color-brand-primary)]" />
                <span className="truncate">
                  {unidade.latitude !== null && unidade.longitude !== null
                    ? `${unidade.latitude.toFixed(5)}, ${unidade.longitude.toFixed(5)}`
                    : 'Sem localização GPS'}
                </span>
              </span>
              <span className="flex items-center gap-2">
                <ClipboardList className="h-4 w-4 shrink-0 text-[var(--color-brand-primary)]" />
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
