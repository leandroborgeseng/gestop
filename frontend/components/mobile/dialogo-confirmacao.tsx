'use client';

/** M-2: diálogo de confirmação do app de campo (botão principal com foco inicial; alvos de toque ≥ 44 px). */
import { useEffect, useId, useRef } from 'react';
import { PendenciasPortal } from '@/components/pendencias/pendencias-acesso-dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';

export function DialogoConfirmacao({
  open,
  titulo,
  texto,
  principal,
  secundario,
  onPrincipal,
  onSecundario,
  perigoSecundario = false,
  testid,
}: {
  open: boolean;
  titulo: string;
  texto: string;
  principal: string;
  secundario: string;
  onPrincipal: () => void;
  onSecundario: () => void;
  perigoSecundario?: boolean;
  testid?: string;
}) {
  const principalRef = useRef<HTMLButtonElement>(null);
  const id = useId();
  useEffect(() => {
    if (open) principalRef.current?.focus();
  }, [open]);
  if (!open) return null;
  return (
    <PendenciasPortal>
      <div className="fixed inset-0 z-[140] flex items-end justify-center bg-black/45 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:items-center" role="presentation">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={`${id}-t`}
          aria-describedby={`${id}-d`}
          data-testid={testid}
          className="w-full max-w-md rounded-[16px] bg-[var(--canvas)] p-4"
          onKeyDown={(event) => {
            if (event.key === 'Escape') onPrincipal();
          }}
        >
          <h2 id={`${id}-t`} className="text-[16px] font-semibold text-[var(--ink)]">
            {titulo}
          </h2>
          <p id={`${id}-d`} className="mt-1 text-[13px] text-[var(--ink-3)]">
            {texto}
          </p>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row-reverse">
            <Button ref={principalRef} type="button" variant="filled" className="min-h-11 w-full sm:w-auto" data-testid="dialogo-principal" onClick={onPrincipal}>
              {principal}
            </Button>
            <Button
              type="button"
              variant="outlined"
              className={cn('min-h-11 w-full sm:w-auto', perigoSecundario && 'border-[var(--danger)] text-[var(--danger)]')}
              data-testid="dialogo-secundario"
              onClick={onSecundario}
            >
              {secundario}
            </Button>
          </div>
        </div>
      </div>
    </PendenciasPortal>
  );
}
