'use client';

import { useEffect, useState } from 'react';
import { GitBranch, Wrench } from 'lucide-react';
import { AuthGate } from '@/components/auth-gate';
import { PageShell } from '@/components/layout/page-shell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui-states';
import { listOrdensServico, updateOrdemServico } from '@/lib/api';
import { OrdemServicoResumo } from '@/lib/types';

export default function OrdensServicoPage() {
  const [ordens, setOrdens] = useState<OrdemServicoResumo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, []);

  function load() {
    setLoading(true);
    listOrdensServico()
      .then(setOrdens)
      .catch((err) => setError(err instanceof Error ? err.message : 'Falha ao carregar ordens de serviço.'))
      .finally(() => setLoading(false));
  }

  async function transition(id: string, status: string) {
    setError(null);
    try {
      await updateOrdemServico(id, { status, motivo: `Transição via painel para ${status}` });
      await listOrdensServico().then(setOrdens);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao atualizar OS.');
    }
  }

  return (
    <AuthGate requiredPermissions={['chamados.gerenciar']}>
      <PageShell
        kicker="Ordens de Serviço"
        icon={Wrench}
        title="OS geradas por não conformidades"
        description="Visualize a rastreabilidade entre fiscalização, item não conforme e ordem de serviço criada automaticamente."
        backHref="/cco"
      >
        {error ? <div className="mb-6"><ErrorState message={error} /></div> : null}
        {loading ? <LoadingState label="Carregando ordens de serviço..." /> : null}

        {!loading ? (
          <section className="space-y-4">
            {ordens.length === 0 ? (
              <EmptyState
                title="Nenhuma ordem de serviço"
                description="Nenhuma ordem de serviço gerada ainda."
              />
            ) : null}

            {ordens.map((ordem) => (
              <Card key={ordem.id} className="transition-all duration-200 hover:shadow-md">
                <CardContent className="p-5">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <Badge variant="warning" className="gap-1.5">
                        <Wrench className="h-3.5 w-3.5" />
                        {ordem.codigo} · {ordem.status}
                      </Badge>
                      <h2 className="mt-3 text-xl font-semibold tracking-tight text-zinc-950">{ordem.titulo}</h2>
                      <p className="mt-1 text-sm text-zinc-500">
                        {ordem.unidade.nome} · {ordem.secretaria.sigla}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-zinc-50 px-4 py-3 text-sm text-zinc-500 ring-1 ring-zinc-200/80">
                      Prioridade
                      <strong className="block text-lg text-zinc-950">{ordem.prioridade}</strong>
                    </div>
                  </div>

                  {ordem.naoConformidade ? (
                    <div className="mt-4 rounded-2xl border border-blue-100 bg-blue-50/80 p-4 text-sm text-blue-950">
                      <p className="flex items-center gap-2 font-semibold">
                        <GitBranch className="h-4 w-4" />
                        Origem auditável
                      </p>
                      <p className="mt-2">
                        Fiscalização `{ordem.naoConformidade.fiscalizacaoId}` · item{' '}
                        {ordem.naoConformidade.item.codigo} - {ordem.naoConformidade.item.titulo}
                      </p>
                      <p className="mt-1 text-blue-800">{ordem.naoConformidade.descricao}</p>
                    </div>
                  ) : null}

                  <div className="mt-4 flex flex-wrap gap-2">
                    {nextStatuses(ordem.status).map((status) => (
                      <Button
                        key={status}
                        variant="secondary"
                        size="sm"
                        onClick={() => transition(ordem.id, status)}
                      >
                        Mover para {status}
                      </Button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </section>
        ) : null}
      </PageShell>
    </AuthGate>
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
