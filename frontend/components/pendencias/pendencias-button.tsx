'use client';

import { useEffect, useState } from 'react';
import { ListTodo } from 'lucide-react';
import { getPendenciasResumo, type PendenciasResumo } from '@/lib/api';
import { PendenciasAcessoDialog, PendenciasVazio } from '@/components/pendencias/pendencias-acesso-dialog';

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
