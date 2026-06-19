'use client';

import { useEffect, useState } from 'react';
import { Sheet } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { ChamadoResumo, EquipeOpcao } from '@/lib/types';
import { chamadoTitulo } from '@/lib/chamado-geo';
import { toInputDate } from '@/lib/cronograma';

export function ChamadoProgramacaoDialog({
  open,
  chamado,
  equipes,
  busy,
  onClose,
  onConfirm,
}: {
  open: boolean;
  chamado: ChamadoResumo | null;
  equipes: EquipeOpcao[];
  busy?: boolean;
  onClose: () => void;
  onConfirm: (payload: { chamadoId: string; date: string; equipeId: string }) => void;
}) {
  const minDate = toInputDate(new Date());
  const [formDate, setFormDate] = useState('');
  const [formEquipeId, setFormEquipeId] = useState('');

  useEffect(() => {
    if (!open || !chamado) return;
    setFormDate(chamado.previstaExecucaoEm?.slice(0, 10) ?? minDate);
    setFormEquipeId(chamado.equipe?.id ?? '');
  }, [open, chamado, minDate]);

  if (!chamado) return null;

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Programar chamado"
      footer={
        <div className="flex gap-2">
          <Button
            variant="filled"
            className="flex-1"
            disabled={busy || !formDate || !formEquipeId}
            onClick={() => onConfirm({ chamadoId: chamado.id, date: formDate, equipeId: formEquipeId })}
          >
            Salvar programação
          </Button>
          <Button variant="outlined" className="flex-1" onClick={onClose}>
            Cancelar
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div>
          <p className="mono text-[12px] font-semibold text-[var(--brand-hover)]">{chamado.codigo}</p>
          <p className="mt-1 text-[14px] font-semibold text-[var(--ink)]">{chamadoTitulo(chamado)}</p>
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-semibold text-[var(--ink-3)]">Data de execução</label>
          <input
            type="date"
            min={minDate}
            value={formDate}
            onChange={(event) => setFormDate(event.target.value)}
            className="h-9 w-full rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--surface)] px-3 text-[13px]"
          />
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-semibold text-[var(--ink-3)]">Equipe</label>
          <Select value={formEquipeId} onChange={(event) => setFormEquipeId(event.target.value)} className="h-9 w-full text-xs">
            <option value="">Selecione a equipe</option>
            {equipes.map((equipe) => (
              <option key={equipe.id} value={equipe.id}>
                {equipe.nome}
                {equipe.secretaria?.sigla ? ` · ${equipe.secretaria.sigla}` : ''}
              </option>
            ))}
          </Select>
        </div>
      </div>
    </Sheet>
  );
}
