'use client';

import { useEffect, useState } from 'react';
import { Megaphone } from 'lucide-react';
import { Sheet } from '@/components/ui/sheet';
import { LoadingState } from '@/components/ui-states';
import { Chip } from '@/components/ui/chip';
import { ZoomableAuthenticatedImage } from '@/components/ui/zoomable-authenticated-image';
import { listMobileChamadosPendentes } from '@/lib/api';
import { chamadoTitulo } from '@/lib/chamado-geo';
import { resolveStorageApiPath } from '@/lib/storage-url';

type ChamadoPendenteItem = Awaited<ReturnType<typeof listMobileChamadosPendentes>>['items'][number];

export function ChamadosPendentesUnidadeSheet({
  open,
  onClose,
  unidadeId,
  unidadeNome,
}: {
  open: boolean;
  onClose: () => void;
  unidadeId: string;
  unidadeNome?: string;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<ChamadoPendenteItem[]>([]);

  useEffect(() => {
    if (!open || !unidadeId) return;

    let active = true;
    setLoading(true);
    setError(null);

    listMobileChamadosPendentes(unidadeId)
      .then((data) => {
        if (!active) return;
        setItems(data.items);
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Falha ao carregar chamados pendentes.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [open, unidadeId]);

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Chamados pendentes deste próprio"
      className="max-h-[90dvh]"
    >
      <div className="flex max-h-[min(70dvh,640px)] flex-col gap-3 overflow-y-auto overscroll-contain pr-1">
        {unidadeNome ? (
          <p className="text-[13px] text-[var(--ink-3)]">
            Consulta somente leitura · {unidadeNome}
          </p>
        ) : null}

        {loading ? <LoadingState label="Carregando chamados pendentes..." /> : null}
        {error ? <p className="text-[13px] text-[var(--danger)]">{error}</p> : null}

        {!loading && !error && items.length === 0 ? (
          <p className="rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--surface-2)] p-4 text-[13px] text-[var(--ink-3)]">
            Não há chamados pendentes para este próprio.
          </p>
        ) : null}

        {!loading
          ? items.map((chamado) => {
              const fotos = [
                ...(chamado.fotoUrl
                  ? [{ id: 'capa', url: chamado.fotoUrl, tipo: 'FOTO' as const }]
                  : []),
                ...chamado.evidencias.map((ev) => ({
                  id: ev.id,
                  url: ev.url,
                  tipo: ev.tipo,
                })),
              ];
              const descricao =
                chamado.descricao.length > 160
                  ? `${chamado.descricao.slice(0, 157)}…`
                  : chamado.descricao;

              return (
                <article
                  key={chamado.id}
                  className="rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--surface-2)] p-4"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Chip variant="brand">{chamado.codigo}</Chip>
                    <Chip>{chamado.status}</Chip>
                    <Chip variant="warning">{chamado.prioridade}</Chip>
                  </div>
                  <p className="mt-2 flex items-center gap-2 text-[14px] font-semibold text-[var(--ink)]">
                    <Megaphone className="h-4 w-4 shrink-0 text-[var(--brand)]" />
                    {chamado.tipoChamado?.nome ?? chamadoTitulo(chamado)}
                  </p>
                  <p className="mt-1 text-[13px] text-[var(--ink-2)]">{descricao}</p>
                  <dl className="mt-3 grid gap-1.5 text-[12px] text-[var(--ink-3)] sm:grid-cols-2">
                    <div>
                      <dt className="font-semibold uppercase tracking-wide">Abertura</dt>
                      <dd>{new Date(chamado.createdAt).toLocaleString('pt-BR')}</dd>
                    </div>
                    <div>
                      <dt className="font-semibold uppercase tracking-wide">Data prevista</dt>
                      <dd>
                        {chamado.previstaExecucaoEm
                          ? new Date(chamado.previstaExecucaoEm).toLocaleDateString('pt-BR')
                          : chamado.prazoEm
                            ? new Date(chamado.prazoEm).toLocaleDateString('pt-BR')
                            : '—'}
                      </dd>
                    </div>
                    <div>
                      <dt className="font-semibold uppercase tracking-wide">Equipe</dt>
                      <dd>{chamado.equipe?.nome ?? 'não atribuída'}</dd>
                    </div>
                    <div>
                      <dt className="font-semibold uppercase tracking-wide">Responsável</dt>
                      <dd>{chamado.responsavel?.nome ?? 'não atribuído'}</dd>
                    </div>
                  </dl>

                  {fotos.length > 0 ? (
                    <div className="mt-3 grid grid-cols-3 gap-2">
                      {fotos.slice(0, 6).map((foto, index) => (
                        <ZoomableAuthenticatedImage
                          key={foto.id}
                          src={resolveStorageApiPath(foto.url) ?? foto.url}
                          alt={`Anexo ${index + 1} do chamado ${chamado.codigo}`}
                          className="aspect-square w-full rounded-[var(--r-sm)] object-cover"
                        />
                      ))}
                    </div>
                  ) : null}
                </article>
              );
            })
          : null}
      </div>
    </Sheet>
  );
}
