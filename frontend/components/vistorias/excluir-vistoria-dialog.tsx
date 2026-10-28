'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { excluirFiscalizacao } from '@/lib/api';
import { MOTIVO_EXCLUSAO_MIN, motivoExclusaoValido, TEXTO_EXCLUSAO_VISTORIA } from '@/lib/vistoria-exclusao';

type Props = {
  fiscalizacaoId: string;
  unidadeNome: string;
  onClose: () => void;
  onExcluida: () => void;
  onErro: (mensagem: string) => void;
};

/** 305/E1: modal de exclusão lógica com motivo obrigatório. */
export function ExcluirVistoriaDialog({ fiscalizacaoId, unidadeNome, onClose, onExcluida, onErro }: Props) {
  const [motivo, setMotivo] = useState('');
  const [busy, setBusy] = useState(false);
  const ok = motivoExclusaoValido(motivo);
  const tamanho = motivo.replace(/\s+/g, ' ').trim().length;

  async function confirmar() {
    if (!ok || busy) return;
    setBusy(true);
    try {
      await excluirFiscalizacao(fiscalizacaoId, motivo.trim());
      onExcluida();
    } catch (err) {
      onErro(err instanceof Error ? err.message : 'Falha ao excluir a vistoria.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/45 p-4 sm:items-center" role="presentation">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="exclusao-vistoria-titulo"
        data-testid="dialog-excluir-vistoria"
        className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-[var(--r-card)] border border-[var(--line)] bg-[var(--surface)] p-5 shadow-[var(--sh-md)]"
      >
        <h3 id="exclusao-vistoria-titulo" className="text-[16px] font-semibold text-[var(--ink)]">
          Excluir vistoria
        </h3>
        <p className="mt-1 text-[13px] font-medium text-[var(--ink-2)]">{unidadeNome}</p>
        <p className="mt-2 text-[13px] leading-relaxed text-[var(--ink-2)]">{TEXTO_EXCLUSAO_VISTORIA}</p>
        <label htmlFor="motivo-exclusao-vistoria" className="mt-4 block text-[12px] font-semibold text-[var(--ink-2)]">
          Motivo (obrigatório)
        </label>
        <textarea
          id="motivo-exclusao-vistoria"
          value={motivo}
          onChange={(event) => setMotivo(event.target.value)}
          rows={4}
          maxLength={1000}
          disabled={busy}
          aria-describedby="motivo-exclusao-vistoria-ajuda"
          placeholder={`Descreva o motivo, com pelo menos ${MOTIVO_EXCLUSAO_MIN} caracteres.`}
          className="mt-1 w-full rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-[13px] focus:border-[var(--brand)] focus:shadow-[0_0_0_3px_var(--brand-soft)] focus:outline-none"
        />
        <p id="motivo-exclusao-vistoria-ajuda" className="mt-1 text-[11px] text-[var(--ink-3)]">
          {tamanho}/{MOTIVO_EXCLUSAO_MIN} caracteres mínimos
        </p>
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <Button type="button" variant="outlined" size="sm" disabled={busy} onClick={onClose}>
            Cancelar
          </Button>
          <Button type="button" variant="danger" size="sm" disabled={busy || !ok} onClick={() => void confirmar()}>
            {busy ? 'Excluindo…' : 'Excluir vistoria'}
          </Button>
        </div>
      </div>
    </div>
  );
}
