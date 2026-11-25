'use client';

import { useEffect, useRef, useState } from 'react';
import { PendenciasPortal } from '@/components/pendencias/pendencias-acesso-dialog';
import { Button } from '@/components/ui/button';
import { CANCELAR_DOCUMENTO_TEXTO, tituloCancelarDocumento } from '@/lib/documento-cancelamento';

/** 287: confirmação do cancelamento lógico. Foco inicial em "Voltar"; motivo opcional. */
export function CancelarDocumentoDialog({
  open,
  codigo,
  busy,
  onVoltar,
  onConfirmar,
}: {
  open: boolean;
  codigo: string;
  busy?: boolean;
  onVoltar: () => void;
  onConfirmar: (motivo: string) => void;
}) {
  const [motivo, setMotivo] = useState('');
  const voltarRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    setMotivo('');
    voltarRef.current?.focus();
  }, [open]);

  if (!open) return null;

  return (
    <PendenciasPortal>
      <div className="fixed inset-0 z-[140] flex items-end justify-center bg-black/45 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:items-center" role="presentation">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="cancelar-documento-titulo"
          aria-describedby="cancelar-documento-texto"
          className="w-full max-w-md rounded-[16px] bg-[var(--canvas)] p-4"
          onKeyDown={(event) => {
            if (event.key === 'Escape') onVoltar();
          }}
        >
          <h2 id="cancelar-documento-titulo" className="text-[16px] font-semibold text-[var(--ink)]">
            {tituloCancelarDocumento(codigo)}
          </h2>
          <p id="cancelar-documento-texto" className="mt-1 text-[13px] text-[var(--ink-3)]">
            {CANCELAR_DOCUMENTO_TEXTO}
          </p>
          <label className="mt-3 block text-[12px] font-medium text-[var(--ink-2)]">
            Motivo (opcional)
            <textarea
              value={motivo}
              onChange={(event) => setMotivo(event.target.value)}
              maxLength={1000}
              rows={3}
              className="mt-1 w-full rounded-[10px] border border-[var(--line)] bg-[var(--canvas)] p-2 text-[13px] outline-none focus:border-[var(--brand)]"
            />
          </label>
          <div className="mt-4 flex justify-end gap-2">
            <Button ref={voltarRef} type="button" variant="outlined" size="sm" className="min-h-11 sm:min-h-8" disabled={busy} onClick={onVoltar}>
              Voltar
            </Button>
            <Button
              type="button"
              variant="filled"
              size="sm"
              className="min-h-11 bg-[var(--danger)] text-white hover:bg-[var(--danger)] sm:min-h-8"
              data-testid="confirmar-cancelar-documento"
              disabled={busy}
              onClick={() => onConfirmar(motivo)}
            >
              Cancelar documento
            </Button>
          </div>
        </div>
      </div>
    </PendenciasPortal>
  );
}
