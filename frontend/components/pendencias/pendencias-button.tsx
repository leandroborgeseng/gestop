'use client';

import { useEffect, useState } from 'react';
import { ListTodo } from 'lucide-react';
import { getPendenciasResumo, type PendenciasResumo } from '@/lib/api';
import { PendenciasAcessoDialog } from '@/components/pendencias/pendencias-acesso-dialog';

export function PendenciasButton({ compact = false }: { compact?: boolean }) {
  const [resumo, setResumo] = useState<PendenciasResumo | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let ativo = true;
    getPendenciasResumo()
      .then((data) => {
        if (ativo) setResumo(data);
      })
      .catch(() => {
        if (ativo) setResumo({ total: 0, grupos: [] });
      });
    return () => {
      ativo = false;
    };
  }, []);

  const total = resumo?.total ?? 0;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          compact
            ? 'relative flex h-9 w-9 items-center justify-center rounded-[var(--r-md)] border border-[var(--line)] text-[var(--brand)]'
            : 'relative flex h-8 items-center gap-1.5 rounded-[var(--r-pill)] border border-[var(--line)] bg-[var(--surface)] px-2.5 text-[12.5px] font-semibold text-[var(--ink-2)] hover:border-[var(--brand)] hover:bg-[var(--brand-soft)] hover:text-[var(--brand)]'
        }
      >
        <ListTodo className="h-4 w-4 text-[var(--brand)]" />
        {compact ? <span className="sr-only">Pendências</span> : 'Pendências'}
        <span className="mono absolute -top-1 -right-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--brand)] px-1 text-[10px] font-bold text-white">
          {total > 99 ? '99+' : total}
        </span>
      </button>
      <PendenciasAcessoDialog open={open && total > 0} resumo={resumo} onClose={() => setOpen(false)} />
      {open && total === 0 ? (
        <PendenciasVazio onClose={() => setOpen(false)} />
      ) : null}
    </>
  );
}

function PendenciasVazio({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[140] flex items-end justify-center bg-black/45 p-3 sm:items-center" role="presentation">
      <div role="dialog" aria-modal="true" className="w-full max-w-sm rounded-[16px] bg-[var(--canvas)] p-4">
        <h2 className="text-[16px] font-semibold text-[var(--ink)]">Pendências</h2>
        <p className="mt-1 text-[13px] text-[var(--ink-3)]">Nenhuma pendência no momento.</p>
        <button type="button" className="mt-3 text-[13px] font-semibold text-[var(--brand)]" onClick={onClose}>
          Fechar
        </button>
      </div>
    </div>
  );
}
