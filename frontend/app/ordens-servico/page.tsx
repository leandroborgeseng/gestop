'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, GitBranch, Wrench } from 'lucide-react';
import { AuthGate } from '@/components/auth-gate';
import { ErrorState, LoadingState } from '@/components/ui-states';
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
      <main className="gestop-shell p-4 md:p-6">
        <div className="mx-auto max-w-6xl">
          <Link href="/cco" className="mb-4 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50">
            <ArrowLeft className="h-4 w-4" />
            Voltar para CCO
          </Link>

          <header className="mb-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wide text-amber-700">Ordens de Serviço</p>
            <h1 className="mt-2 text-3xl font-bold text-slate-950">OS geradas por não conformidades</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Visualize a rastreabilidade entre fiscalização, item não conforme e ordem de serviço criada automaticamente.
            </p>
          </header>

          {error ? <ErrorState message={error} /> : null}
          {loading ? <LoadingState label="Carregando ordens de serviço..." /> : null}

          {!loading ? (
            <section className="space-y-4">
              {ordens.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-600">
                  Nenhuma ordem de serviço gerada ainda.
                </div>
              ) : null}

              {ordens.map((ordem) => (
                <article key={ordem.id} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <span className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1 text-xs font-bold uppercase tracking-wide text-amber-700">
                        <Wrench className="h-3.5 w-3.5" />
                        {ordem.codigo} · {ordem.status}
                      </span>
                      <h2 className="mt-3 text-xl font-bold text-slate-950">{ordem.titulo}</h2>
                      <p className="mt-1 text-sm text-slate-600">{ordem.unidade.nome} · {ordem.secretaria.sigla}</p>
                    </div>
                    <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
                      Prioridade
                      <strong className="block text-lg text-slate-950">{ordem.prioridade}</strong>
                    </div>
                  </div>

                  {ordem.naoConformidade ? (
                    <div className="mt-4 rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-950">
                      <p className="flex items-center gap-2 font-bold">
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
                      <button
                        key={status}
                        onClick={() => transition(ordem.id, status)}
                        className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        Mover para {status}
                      </button>
                    ))}
                  </div>
                </article>
              ))}
            </section>
          ) : null}
        </div>
      </main>
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
