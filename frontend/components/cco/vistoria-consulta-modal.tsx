'use client';

/**
 * #311 — modal de consulta (só leitura) de uma vistoria a partir da aba Vistorias do drawer do CCO.
 * Reusa o corpo do detalhe de Vistorias realizadas (`VistoriaDetalheCorpo`); só faz GET.
 * Renderiza em portal acima do drawer (z-110) e do mapa em tela cheia; o lightbox de fotos fica acima dele.
 */
import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { ArrowUpRight, X } from 'lucide-react';
import { useSessionUser } from '@/components/auth/session-context';
import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/icon-button';
import { ErrorState, LoadingState } from '@/components/ui-states';
import { VistoriaDetalheCorpo } from '@/components/vistorias/vistoria-detalhe-consulta';
import { getFiscalizacao } from '@/lib/api';
import { podeAbrirLinkChamado } from '@/lib/nc-chamado-link';
import type { FiscalizacaoDetalhe } from '@/lib/types';
import { hrefVistoriaRealizada } from '@/lib/vistoria-deep-link';
import { useOverlayPortalHost } from '@/lib/overlay-portal-host';

export const MSG_VISTORIA_403 = 'Você não tem permissão para consultar esta vistoria.';
export const MSG_VISTORIA_ERRO = 'Não foi possível abrir a vistoria. Tente de novo.';

export function VistoriaConsultaModal({
  fiscalizacaoId,
  unidadeNome,
  onClose,
}: {
  fiscalizacaoId: string;
  unidadeNome: string;
  onClose: () => void;
}) {
  const titleId = useId();
  const sessionUser = useSessionUser();
  const [detail, setDetail] = useState<FiscalizacaoDetalhe | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const host = useOverlayPortalHost();
  const closeRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    setDetail(null);
    getFiscalizacao(fiscalizacaoId)
      .then((data) => {
        if (active) setDetail(data);
      })
      .catch((err: unknown) => {
        if (!active) return;
        const status = (err as { status?: number })?.status;
        setError(status === 403 ? MSG_VISTORIA_403 : MSG_VISTORIA_ERRO);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [fiscalizacaoId]);

  useEffect(() => {
    // Captura: Esc fecha só o modal (não o drawer nem o fullscreen do mapa); com lightbox aberto, Esc é dele.
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      if (document.querySelector('[data-zoom-lightbox]')) return;
      event.preventDefault();
      onCloseRef.current();
    }
    window.addEventListener('keydown', onKeyDown, true);
    closeRef.current?.focus();
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, []);

  if (!host) return null;

  const href = hrefVistoriaRealizada(fiscalizacaoId);
  const podeAbrirTela = podeAbrirLinkChamado(href, sessionUser?.permissoes ?? [], sessionUser);

  return createPortal(
    <div data-cco-vistoria-modal className="fixed inset-0 z-[120] flex items-end justify-center sm:items-center sm:p-4">
      <button
        type="button"
        aria-label="Fechar"
        tabIndex={-1}
        className="absolute inset-0 bg-[rgba(15,23,42,0.5)]"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        data-testid="cco-vistoria-modal"
        data-fiscalizacao-id={fiscalizacaoId}
        className="relative flex max-h-[calc(100dvh-env(safe-area-inset-bottom)-4.5rem)] w-full flex-col overflow-hidden rounded-t-[var(--r-lg)] border border-[var(--line)] bg-[var(--surface)] shadow-[var(--sh-lg)] sm:max-h-[90dvh] sm:w-[90vw] sm:max-w-[880px] sm:rounded-[var(--r-lg)] lg:mb-0"
      >
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-[var(--line-2)] p-4">
          <div className="min-w-0">
            <h2 id={titleId} className="text-[16px] font-bold text-[var(--ink)]">
              Consulta da vistoria
            </h2>
            <p className="mt-0.5 truncate text-[12px] text-[var(--ink-3)]">{unidadeNome}</p>
          </div>
          <IconButton ref={closeRef} variant="ghost" size="sm" aria-label="Fechar" onClick={onClose}>
            <X className="h-4 w-4" />
          </IconButton>
        </header>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
          {loading ? <LoadingState label="Carregando detalhe…" /> : null}
          {error ? <ErrorState message={error} /> : null}
          {detail ? (
            <>
              <p className="mono text-[11px] text-[var(--ink-3)]" data-testid="cco-vistoria-id">
                ID {detail.id}
              </p>
              <VistoriaDetalheCorpo resumo={detail} detail={detail} detailLoading={false} />
            </>
          ) : null}
        </div>

        <footer className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-[var(--line-2)] p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <Button type="button" variant="text" size="sm" onClick={onClose}>
            Fechar
          </Button>
          {podeAbrirTela && !error ? (
            <Link href={href} data-testid="cco-vistoria-abrir-realizadas">
              <Button type="button" variant="outlined" size="sm">
                Abrir em Vistorias realizadas
                <ArrowUpRight className="ml-1 h-3.5 w-3.5" />
              </Button>
            </Link>
          ) : null}
        </footer>
      </div>
    </div>,
    host,
  );
}
