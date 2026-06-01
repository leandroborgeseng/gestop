'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Clock3, GitBranch, ImageIcon, Wrench } from 'lucide-react';
import { RequirePermissions } from '@/components/auth/require-permissions';
import { PageShell } from '@/components/layout/page-shell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ErrorState, LoadingState } from '@/components/ui-states';
import { getOrdemServico, updateOrdemServico } from '@/lib/api';
import { OrdemServicoDetalhe } from '@/lib/types';

export default function OrdemServicoDetalhePage() {
  const params = useParams<{ id: string }>();
  const [ordem, setOrdem] = useState<OrdemServicoDetalhe | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!params.id) return;
    getOrdemServico(params.id)
      .then(setOrdem)
      .catch((err) => setError(err instanceof Error ? err.message : 'Falha ao carregar OS.'))
      .finally(() => setLoading(false));
  }, [params.id]);

  async function transition(status: string) {
    if (!ordem) return;
    setError(null);
    try {
      await updateOrdemServico(ordem.id, { status, motivo: `Transição via detalhe para ${status}` });
      const refreshed = await getOrdemServico(ordem.id);
      setOrdem(refreshed);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao atualizar OS.');
    }
  }

  return (
    <RequirePermissions permissions={['chamados.gerenciar']}>
      <PageShell
        kicker="Ordens de Serviço"
        icon={Wrench}
        title={ordem?.codigo ?? 'Detalhe da OS'}
        description="Histórico, origem auditável e evidências vinculadas."
        backHref="/ordens-servico"
      >
        <div className="mb-4">
          <Link href="/ordens-servico" className="inline-flex items-center gap-2 md-label-lg text-[var(--color-brand-primary)]">
            <ArrowLeft className="h-4 w-4" />
            Voltar para lista
          </Link>
        </div>

        {error ? <div className="mb-6"><ErrorState message={error} /></div> : null}
        {loading ? <LoadingState label="Carregando ordem de serviço..." /> : null}

        {ordem ? (
          <div className="space-y-4">
            <Card elevation={1}>
              <CardContent className="space-y-4 p-5">
                <Badge variant="warning">{ordem.status} · {ordem.prioridade}</Badge>
                <h1 className="md-headline-md text-[var(--md-on-surface)]">{ordem.titulo}</h1>
                <p className="md-body-lg text-[var(--md-on-surface-variant)]">{ordem.descricao}</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Info label="Unidade" value={ordem.unidade.nome} />
                  <Info label="Secretaria" value={ordem.secretaria.sigla} />
                  <Info label="Responsável" value={ordem.responsavel?.nome ?? 'Não atribuído'} />
                  <Info label="Prazo" value={ordem.prazoEm ? new Date(ordem.prazoEm).toLocaleDateString('pt-BR') : 'Sem prazo'} />
                </div>
                <div className="flex flex-wrap gap-2">
                  {nextStatuses(ordem.status).map((status) => (
                    <Button key={status} variant="tonal" size="sm" onClick={() => transition(status)}>
                      Mover para {status}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {ordem.naoConformidade ? (
              <Card elevation={1}>
                <CardContent className="space-y-3 p-5">
                  <p className="md-label-lg flex items-center gap-2 text-[var(--color-brand-primary)]">
                    <GitBranch className="h-4 w-4" />
                    Origem auditável
                  </p>
                  <p className="md-body-md">{ordem.naoConformidade.item.codigo} — {ordem.naoConformidade.item.titulo}</p>
                  <p className="md-body-md text-[var(--md-on-surface-variant)]">{ordem.naoConformidade.descricao}</p>
                </CardContent>
              </Card>
            ) : null}

            {ordem.evidencias.length > 0 ? (
              <Card elevation={1}>
                <CardContent className="space-y-4 p-5">
                  <p className="md-title-md flex items-center gap-2">
                    <ImageIcon className="h-5 w-5" />
                    Evidências ({ordem.evidencias.length})
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {ordem.evidencias.map((evidencia) => (
                      <a
                        key={evidencia.id}
                        href={evidencia.url}
                        target="_blank"
                        rel="noreferrer"
                        className="overflow-hidden rounded-[var(--md-shape-md)] border border-[var(--md-outline-variant)]"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={evidencia.url} alt="Evidência" className="h-40 w-full object-cover" />
                      </a>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ) : null}

            <Card elevation={1}>
              <CardContent className="space-y-4 p-5">
                <p className="md-title-md flex items-center gap-2">
                  <Clock3 className="h-5 w-5" />
                  Histórico de status
                </p>
                <div className="space-y-3">
                  {ordem.historico.map((evento) => (
                    <div key={evento.id} className="rounded-[var(--md-shape-md)] bg-[var(--md-surface-container-low)] p-4">
                      <p className="md-label-lg text-[var(--md-on-surface)]">
                        {evento.statusAnterior ? `${evento.statusAnterior} → ${evento.statusNovo}` : evento.statusNovo}
                      </p>
                      <p className="md-body-md mt-1 text-[var(--md-on-surface-variant)]">{evento.motivo}</p>
                      <p className="md-body-md mt-2 text-[var(--md-on-surface-variant)]">
                        {new Date(evento.createdAt).toLocaleString('pt-BR')}
                        {evento.alteradoPor ? ` · ${evento.alteradoPor.nome}` : ''}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        ) : null}
      </PageShell>
    </RequirePermissions>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[var(--md-shape-md)] bg-[var(--md-surface-container-low)] px-4 py-3">
      <p className="md-label-md text-[var(--md-on-surface-variant)]">{label}</p>
      <p className="md-title-md mt-0.5 text-[var(--md-on-surface)]">{value}</p>
    </div>
  );
}

function nextStatuses(status: string) {
  const transitions: Record<string, string[]> = {
    ABERTA: ['EM_TRIAGEM', 'ATRIBUIDA', 'CANCELADA'],
    EM_TRIAGEM: ['ATRIBUIDA', 'CANCELADA'],
    ATRIBUIDA: ['EM_EXECUCAO', 'IMPEDIDA', 'CANCELADA'],
    EM_EXECUCAO: ['CONCLUIDA', 'IMPEDIDA'],
    IMPEDIDA: ['ATRIBUIDA', 'EM_EXECUCAO', 'CANCELADA'],
    CONCLUIDA: [],
    CANCELADA: [],
  };
  return transitions[status] ?? [];
}
