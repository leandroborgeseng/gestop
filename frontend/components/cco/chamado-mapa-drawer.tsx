'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowUpRight, X } from 'lucide-react';
import { ChamadoMapaItem } from '@/lib/types';
import { CHAMADO_STATUS_META, prazoInfo } from '@/lib/chamado-status';
import { Badge } from '@/components/ui/badge';
import { IconButton } from '@/components/ui/icon-button';

export function ChamadoMapaDrawer({
  chamado,
  open,
  onClose,
}: {
  chamado: ChamadoMapaItem | null;
  open: boolean;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  if (!open || !chamado || !mounted) return null;

  const statusMeta = CHAMADO_STATUS_META[chamado.status];
  const prazo = prazoInfo(chamado.prazoEm, chamado.status);
  const titulo = chamado.titulo?.trim() || chamado.descricao;

  return createPortal(
    <>
      <button
        type="button"
        aria-label="Fechar detalhe do chamado"
        className="fixed inset-0 z-[100] bg-black/25"
        onClick={onClose}
      />
      <aside className="fixed inset-y-0 right-0 z-[110] flex h-dvh max-h-dvh w-full max-w-md flex-col border-l border-[var(--line)] bg-[var(--surface)] shadow-[var(--sh-lg)]">
        <div className="flex shrink-0 items-start gap-3 border-b border-[var(--line-2)] px-4 py-3.5">
          <div className="min-w-0 flex-1">
            <div className="mono text-[11px] font-semibold text-[var(--brand-hover)]">{chamado.codigo}</div>
            <h2 className="mt-0.5 text-[15px] font-semibold text-[var(--ink)]">{titulo}</h2>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Badge variant={statusMeta?.badge ?? 'muted'}>{statusMeta?.label ?? chamado.status}</Badge>
              <Badge variant="neutral">{chamado.prioridade}</Badge>
              {chamado.slaMapa ? (
                <Badge variant={chamado.slaMapa === 'FORA' ? 'danger' : 'success'}>
                  {chamado.slaMapa === 'FORA' ? 'Fora do prazo' : 'Dentro do prazo'}
                </Badge>
              ) : null}
            </div>
          </div>
          <IconButton aria-label="Fechar" onClick={onClose}>
            <X className="h-4 w-4" />
          </IconButton>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] text-[13px]">
          <div>
            <div className="text-[11px] font-bold tracking-wide text-[var(--ink-3)] uppercase">Local</div>
            <p className="mt-1 text-[var(--ink-2)]">
              {chamado.unidade?.nome ?? chamado.enderecoTexto ?? 'Sem endereço'}
              {(chamado.enderecoBairro || chamado.unidade?.bairro) &&
                ` · ${chamado.enderecoBairro ?? chamado.unidade?.bairro}`}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-[11px] font-bold tracking-wide text-[var(--ink-3)] uppercase">Secretaria</div>
              <p className="mt-1 text-[var(--ink-2)]">{chamado.secretaria.sigla}</p>
            </div>
            <div>
              <div className="text-[11px] font-bold tracking-wide text-[var(--ink-3)] uppercase">Tipo</div>
              <p className="mt-1 text-[var(--ink-2)]">{chamado.tipoChamado?.nome ?? '—'}</p>
            </div>
            <div>
              <div className="text-[11px] font-bold tracking-wide text-[var(--ink-3)] uppercase">Equipe</div>
              <p className="mt-1 text-[var(--ink-2)]">{chamado.equipe?.nome ?? '—'}</p>
            </div>
            <div>
              <div className="text-[11px] font-bold tracking-wide text-[var(--ink-3)] uppercase">SLA</div>
              <p className="mt-1 text-[var(--ink-2)]">{prazo.sub ?? prazo.label}</p>
            </div>
          </div>
          <div>
            <div className="text-[11px] font-bold tracking-wide text-[var(--ink-3)] uppercase">Descrição</div>
            <p className="mt-1 whitespace-pre-wrap text-[var(--ink-2)]">{chamado.descricao}</p>
          </div>
        </div>

        <div className="shrink-0 border-t border-[var(--line-2)] p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <Link
            href={`/chamados?id=${chamado.id}`}
            className="inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-[var(--r-md)] bg-[var(--brand)] px-4 text-[13px] font-semibold text-white hover:bg-[var(--brand-hover)]"
          >
            Abrir em Chamados
            <ArrowUpRight className="h-4 w-4" />
          </Link>
        </div>
      </aside>
    </>,
    document.body,
  );
}
