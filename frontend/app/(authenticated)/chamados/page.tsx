'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { GitBranch, Megaphone } from 'lucide-react';
import { RequirePermissions } from '@/components/auth/require-permissions';
import { PageShell } from '@/components/layout/page-shell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui-states';
import { convertChamadoToOs, listChamados, updateChamadoStatus } from '@/lib/api';
import { ChamadoResumo, ChamadoStatus } from '@/lib/types';

const STATUS_FILTERS: Array<{ value: 'TODOS' | ChamadoStatus; label: string }> = [
  { value: 'TODOS', label: 'Todos' },
  { value: 'ABERTO', label: 'Abertos' },
  { value: 'EM_TRIAGEM', label: 'Em triagem' },
  { value: 'ENCAMINHADO_OS', label: 'Encaminhados' },
  { value: 'ENCERRADO', label: 'Encerrados' },
  { value: 'CANCELADO', label: 'Cancelados' },
];

export default function ChamadosPage() {
  const [chamados, setChamados] = useState<ChamadoResumo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'TODOS' | ChamadoStatus>('TODOS');
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, []);

  function load() {
    setLoading(true);
    listChamados()
      .then(setChamados)
      .catch((err) => setError(err instanceof Error ? err.message : 'Falha ao carregar chamados.'))
      .finally(() => setLoading(false));
  }

  const filtered = useMemo(() => {
    if (filter === 'TODOS') return chamados;
    return chamados.filter((item) => item.status === filter);
  }, [chamados, filter]);

  async function changeStatus(id: string, status: ChamadoStatus) {
    setBusyId(id);
    setError(null);
    try {
      await updateChamadoStatus(id, { status, motivo: `Atualizado via painel para ${status}` });
      await listChamados().then(setChamados);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao atualizar chamado.');
    } finally {
      setBusyId(null);
    }
  }

  async function convertToOs(id: string) {
    setBusyId(id);
    setError(null);
    try {
      await convertChamadoToOs(id);
      await listChamados().then(setChamados);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao converter chamado em OS.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <RequirePermissions permissions={['chamados.gerenciar']}>
      <PageShell
        kicker="Chamados"
        icon={Megaphone}
        title="Triagem de chamados"
        description="Chamados abertos via QR Code ou registro interno. Converta em ordem de servico quando apropriado."
        backHref="/cco"
      >
        {error ? (
          <div className="mb-6">
            <ErrorState message={error} onRetry={load} />
          </div>
        ) : null}

        <div className="mb-6 flex flex-wrap gap-2">
          {STATUS_FILTERS.map((item) => (
            <Button
              key={item.value}
              variant={filter === item.value ? 'filled' : 'tonal'}
              size="sm"
              onClick={() => setFilter(item.value)}
            >
              {item.label}
            </Button>
          ))}
        </div>

        {loading ? <LoadingState label="Carregando chamados..." /> : null}

        {!loading ? (
          <section className="space-y-4">
            {filtered.length === 0 ? (
              <EmptyState
                title="Nenhum chamado"
                description={filter === 'TODOS' ? 'Nenhum chamado registrado ainda.' : 'Nenhum chamado neste filtro.'}
              />
            ) : null}

            {filtered.map((chamado) => (
              <Card key={chamado.id} elevation={1} className="transition-all hover:shadow-[var(--md-elevation-2)]">
                <CardContent className="p-4 sm:p-5">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <Badge variant="brand" className="gap-1.5">
                        <Megaphone className="h-3.5 w-3.5" />
                        {chamado.codigo} · {chamado.status}
                      </Badge>
                      <p className="md-body-sm mt-2 text-[var(--md-on-surface-variant)]">
                        {chamado.origem} · {new Date(chamado.createdAt).toLocaleString('pt-BR')}
                      </p>
                      <p className="md-body-lg mt-3 text-[var(--md-on-surface)]">{chamado.descricao}</p>
                      <p className="md-body-md mt-2 text-[var(--md-on-surface-variant)]">
                        {chamado.unidade.nome} · {chamado.secretaria.sigla}
                      </p>
                      {chamado.solicitanteNome ? (
                        <p className="md-body-sm mt-1 text-[var(--md-on-surface-variant)]">
                          Solicitante: {chamado.solicitanteNome}
                          {chamado.solicitanteTelefone ? ` · ${chamado.solicitanteTelefone}` : ''}
                        </p>
                      ) : null}
                    </div>
                    <div className="rounded-[var(--md-shape-md)] bg-[var(--md-surface-container-low)] px-4 py-3 md-body-md text-[var(--md-on-surface-variant)]">
                      Prioridade
                      <strong className="md-title-lg mt-0.5 block text-[var(--md-on-surface)]">{chamado.prioridade}</strong>
                    </div>
                  </div>

                  {chamado.ordemServico ? (
                    <div className="mt-4 rounded-[var(--md-shape-md)] bg-[var(--color-brand-primary-subtle)] p-4 md-body-md text-[var(--color-brand-primary)]">
                      <p className="md-label-lg flex items-center gap-2">
                        <GitBranch className="h-4 w-4" />
                        Ordem de servico vinculada
                      </p>
                      <p className="mt-2">
                        <Link href={`/ordens-servico/${chamado.ordemServico.id}`} className="underline">
                          {chamado.ordemServico.codigo}
                        </Link>{' '}
                        · {chamado.ordemServico.status}
                      </p>
                    </div>
                  ) : null}

                  <div className="mt-4 flex flex-wrap gap-2">
                    {nextStatuses(chamado.status).map((status) => (
                      <Button
                        key={status}
                        variant="tonal"
                        size="sm"
                        disabled={busyId === chamado.id}
                        onClick={() => changeStatus(chamado.id, status)}
                      >
                        {statusLabel(status)}
                      </Button>
                    ))}
                    {!chamado.ordemServico && canConvert(chamado.status) ? (
                      <Button
                        variant="filled"
                        size="sm"
                        disabled={busyId === chamado.id}
                        onClick={() => convertToOs(chamado.id)}
                      >
                        Converter em OS
                      </Button>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            ))}
          </section>
        ) : null}
      </PageShell>
    </RequirePermissions>
  );
}

function canConvert(status: ChamadoStatus) {
  return status === 'ABERTO' || status === 'EM_TRIAGEM';
}

function nextStatuses(status: ChamadoStatus): ChamadoStatus[] {
  switch (status) {
    case 'ABERTO':
      return ['EM_TRIAGEM', 'CANCELADO'];
    case 'EM_TRIAGEM':
      return ['ENCERRADO', 'CANCELADO'];
    default:
      return [];
  }
}

function statusLabel(status: ChamadoStatus) {
  switch (status) {
    case 'EM_TRIAGEM':
      return 'Iniciar triagem';
    case 'ENCERRADO':
      return 'Encerrar';
    case 'CANCELADO':
      return 'Cancelar';
    default:
      return status;
  }
}
