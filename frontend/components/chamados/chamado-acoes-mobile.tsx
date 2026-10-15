'use client';

import { useEffect, useRef, useState } from 'react';
import { MoreHorizontal } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { ChamadoAcao, ChamadoAcaoId } from '@/lib/chamado-acoes';

/** 291: menu "⋯" da linha fixa do chamado no celular. Todas as ações do cabeçalho ficam aqui. */
export function ChamadoAcoesMobile({
  acoes,
  onAcao,
  defaultOpen = false,
}: {
  acoes: ChamadoAcao[];
  onAcao: (id: ChamadoAcaoId) => void;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        aria-label="Mais ações"
        aria-haspopup="menu"
        aria-expanded={open}
        data-testid="chamado-mais-acoes"
        onClick={() => setOpen((value) => !value)}
        className="flex h-11 w-11 items-center justify-center rounded-[var(--r-md)] text-[var(--ink-2)] hover:bg-[var(--surface-2)] focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:outline-none"
      >
        <MoreHorizontal className="h-5 w-5" />
      </button>
      {open ? (
        <div
          role="menu"
          aria-label="Ações do chamado"
          data-testid="chamado-mais-acoes-menu"
          className="absolute top-full right-0 z-30 mt-1 min-w-[220px] rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--surface)] py-1 shadow-[var(--sh-md)]"
        >
          {acoes.map((acao) => (
            <button
              key={acao.id}
              type="button"
              role="menuitem"
              data-acao={acao.id}
              disabled={acao.disabled}
              onClick={() => {
                setOpen(false);
                onAcao(acao.id);
              }}
              className={cn(
                'flex min-h-11 w-full items-center justify-between gap-3 px-3 text-left text-[14px] font-medium text-[var(--ink)] hover:bg-[var(--surface-2)] disabled:opacity-50',
                acao.danger && 'text-[var(--danger)]',
              )}
            >
              <span>{acao.label}</span>
              {acao.badge ? (
                <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[var(--brand)] px-1.5 text-[11px] font-semibold text-white">
                  {acao.badge}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
