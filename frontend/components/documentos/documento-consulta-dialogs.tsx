'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { DocumentoAvulsoForm, DocumentoAvulsoRespostasLeitura } from '@/components/documentos/documento-avulso-form';
import type { DocumentoDetalhe } from '@/lib/types';

type JanelaRolavel = Pick<Window, 'scrollY' | 'scrollTo'>;

/** 284: trava a rolagem do fundo com position:fixed (iOS-safe). Retorna a função que restaura. */
export function travarRolagemFundo(win: JanelaRolavel, doc: Pick<Document, 'body'>) {
  const body = doc.body;
  const salvoY = win.scrollY;
  const anterior = {
    position: body.style.position,
    top: body.style.top,
    left: body.style.left,
    right: body.style.right,
    width: body.style.width,
  };
  body.style.position = 'fixed';
  body.style.top = `-${salvoY}px`;
  body.style.left = '0';
  body.style.right = '0';
  body.style.width = '100%';
  return () => {
    body.style.position = anterior.position;
    body.style.top = anterior.top;
    body.style.left = anterior.left;
    body.style.right = anterior.right;
    body.style.width = anterior.width;
    win.scrollTo(0, salvoY);
  };
}

type ViewportVisual = Pick<VisualViewport, 'height' | 'addEventListener' | 'removeEventListener'> & { offsetTop?: number };

/**
 * 284 (A3): no celular, com o teclado aberto, o iOS não encolhe `100dvh`. Acompanha o
 * `visualViewport` e devolve a altura visível (px) só abaixo de 640px; no desktop devolve null.
 */
export function observarAlturaVisivel(
  win: Pick<Window, 'innerWidth'> & { visualViewport?: ViewportVisual | null },
  onAltura: (altura: number | null, topo?: number) => void,
) {
  const vv = win.visualViewport;
  if (!vv) return () => undefined;
  const atualizar = () =>
    win.innerWidth < 640 ? onAltura(Math.round(vv.height), Math.round(vv.offsetTop ?? 0)) : onAltura(null);
  atualizar();
  vv.addEventListener('resize', atualizar);
  vv.addEventListener('scroll', atualizar);
  return () => {
    vv.removeEventListener('resize', atualizar);
    vv.removeEventListener('scroll', atualizar);
  };
}

export function DocumentoPreencherDialog({
  documento,
  onClose,
  onSaved,
}: {
  documento: DocumentoDetalhe | null;
  onClose: () => void;
  onSaved: (info?: { concluido?: boolean }) => void | Promise<void>;
}) {
  const aberto = documento != null;
  const [alturaVisivel, setAlturaVisivel] = useState<number | null>(null);
  const [topoVisivel, setTopoVisivel] = useState(0);
  // 284: o <main> do app-shell é `relative z-0` (cria contexto de empilhamento), então o z-[130]
  // do modal ficava preso ABAIXO do cabeçalho (z-30) e do menu inferior (z-40) no celular.
  // Renderizar no document.body tira o modal desse contexto.
  const [portalAlvo, setPortalAlvo] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setPortalAlvo(document.body);
  }, []);
  useEffect(() => {
    if (!aberto || typeof window === 'undefined') return;
    return observarAlturaVisivel(window, (altura, topo) => {
      setAlturaVisivel(altura);
      setTopoVisivel(topo ?? 0);
    });
  }, [aberto]);
  useEffect(() => {
    if (!aberto || typeof document === 'undefined') return;
    // 284: trava a rolagem do fundo (seguro no iOS) e restaura posição ao fechar.
    return travarRolagemFundo(window, document);
  }, [aberto]);
  if (!documento) return null;
  const modal = (
    <div
      className="fixed inset-0 z-[130] flex items-end justify-center bg-black/45 p-0 pt-[env(safe-area-inset-top)] sm:items-center sm:p-6"
      role="presentation"
      // 284 (A3): com teclado aberto, o fundo escuro e a folha acompanham a área visível.
      style={alturaVisivel != null ? { top: topoVisivel, bottom: 'auto', height: alturaVisivel } : undefined}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="preencher-documento-titulo"
        style={alturaVisivel != null ? { height: `calc(${alturaVisivel}px - env(safe-area-inset-top))` } : undefined}
        className="flex h-[calc(100dvh-env(safe-area-inset-top))] w-full max-w-3xl flex-col overflow-hidden rounded-t-[16px] bg-[var(--canvas)] shadow-[var(--sh-lg)] sm:h-auto sm:max-h-[min(94dvh,920px)] sm:rounded-[16px]"
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-[var(--line)] px-4 py-3">
          <div className="min-w-0">
            <h2 id="preencher-documento-titulo" className="text-[16px] font-semibold text-[var(--ink)]">
              Preencher documento
            </h2>
            <p className="mt-0.5 truncate text-[12px] text-[var(--ink-3)]">
              {documento.codigo} · {documento.titulo}
              {documento.checklist?.nome ? ` · ${documento.checklist.nome}` : ''}
            </p>
          </div>
          <button type="button" aria-label="Fechar" className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full hover:bg-[var(--surface-2)]" onClick={onClose}>
            <X className="h-4 w-4" />
          </button>
        </div>
        <DocumentoAvulsoForm
          key={documento.id}
          documento={documento}
          ocultarTitulo
          layout="dialog"
          onSaved={async (info) => {
            await onSaved(info);
            if (info?.concluido) onClose();
          }}
        />
      </div>
    </div>
  );
  return portalAlvo ? createPortal(modal, portalAlvo) : modal;
}

export function DocumentoRespostasDialog({
  documento,
  onClose,
}: {
  documento: DocumentoDetalhe | null;
  onClose: () => void;
}) {
  if (!documento) return null;
  return (
    <div
      className="fixed inset-0 z-[130] flex items-end justify-center bg-black/45 p-2 pt-[max(0.5rem,env(safe-area-inset-top))] pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:items-center sm:p-6"
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="ver-documento-titulo"
        className="flex max-h-[min(94dvh,920px)] w-full max-w-3xl flex-col overflow-hidden rounded-[16px] bg-[var(--canvas)] shadow-[var(--sh-lg)]"
      >
        <div className="flex items-start justify-between gap-3 border-b border-[var(--line)] px-4 py-3">
          <div className="min-w-0">
            <h2 id="ver-documento-titulo" className="text-[16px] font-semibold text-[var(--ink)]">
              Visualizar documento preenchido
            </h2>
            <p className="mt-0.5 truncate text-[12px] text-[var(--ink-3)]">
              {documento.codigo} · {documento.titulo}
              {documento.checklist?.nome ? ` · ${documento.checklist.nome}` : ''}
            </p>
          </div>
          <button type="button" aria-label="Fechar" className="inline-flex h-9 w-9 items-center justify-center rounded-full hover:bg-[var(--surface-2)]" onClick={onClose}>
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          <DocumentoAvulsoRespostasLeitura documento={documento} />
        </div>
      </div>
    </div>
  );
}
