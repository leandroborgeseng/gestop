'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { FileText } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui-states';
import {
  downloadDocumentoPdfAssinado,
  downloadDocumentoPdfOriginal,
  listDocumentosPorChamado,
  listDocumentosPorFiscalizacao,
} from '@/lib/api';
import { DOCUMENTO_SITUACAO_META, DOCUMENTO_TIPO_LABELS } from '@/lib/documento-status';
import { DocumentoResumo } from '@/lib/types';

type Props = {
  chamadoId?: string;
  fiscalizacaoId?: string;
  onClose?: () => void;
};

export function DocumentosRelacionadosPanel({ chamadoId, fiscalizacaoId, onClose }: Props) {
  const [items, setItems] = useState<DocumentoResumo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    const loader = chamadoId
      ? listDocumentosPorChamado(chamadoId)
      : fiscalizacaoId
        ? listDocumentosPorFiscalizacao(fiscalizacaoId)
        : Promise.resolve({ total: 0, items: [] });

    loader
      .then((response) => {
        if (active) setItems(response.items);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : 'Falha ao carregar documentos.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [chamadoId, fiscalizacaoId]);

  return (
    <div className="space-y-3 rounded-[14px] border border-[var(--line)] bg-[var(--canvas-2)] p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-[var(--brand)]" />
          <h3 className="text-[14px] font-semibold text-[var(--ink)]">Documentos relacionados</h3>
        </div>
        {onClose ? (
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Fechar
          </Button>
        ) : null}
      </div>

      {loading ? <LoadingState label="Carregando documentos..." /> : null}
      {error ? <ErrorState message={error} /> : null}
      {!loading && !error && items.length === 0 ? (
        <EmptyState title="Nenhum documento" description="Ainda não há documentos vinculados a este registro." />
      ) : null}

      <ul className="space-y-2">
        {items.map((item) => {
          const situacao = DOCUMENTO_SITUACAO_META[item.situacao];
          return (
            <li
              key={item.id}
              className="rounded-[12px] border border-[var(--line)] bg-[var(--canvas)] p-3"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="mono text-[12px] font-semibold text-[var(--brand-hover)]">{item.codigo}</p>
                  <p className="mt-0.5 text-[13px] font-medium text-[var(--ink)]">{item.titulo}</p>
                  <p className="text-[12px] text-[var(--ink-3)]">
                    {DOCUMENTO_TIPO_LABELS[item.tipo]} · {new Date(item.createdAt).toLocaleString('pt-BR')}
                  </p>
                </div>
                <Badge variant={situacao.badge}>{situacao.label}</Badge>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Link href={`/documentos?id=${item.id}`}>
                  <Button type="button" size="sm" variant="outlined">
                    Abrir
                  </Button>
                </Link>
                {item.possuiPdfOriginal ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => void downloadDocumentoPdfOriginal(item.id, item.codigo)}
                  >
                    PDF original
                  </Button>
                ) : null}
                {item.possuiPdfAssinado ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => void downloadDocumentoPdfAssinado(item.id, item.codigo)}
                  >
                    PDF assinado
                  </Button>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
