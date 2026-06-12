'use client';

import { useEffect, useState } from 'react';
import { Lightbulb, X } from 'lucide-react';

export function TipBanner({
  id,
  children,
}: {
  id: string;
  children: React.ReactNode;
}) {
  const storageKey = `sigma-tip-dismissed-${id}`;
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      setVisible(localStorage.getItem(storageKey) !== '1');
    } catch {
      setVisible(true);
    }
  }, [storageKey]);

  function dismiss() {
    try {
      localStorage.setItem(storageKey, '1');
    } catch {
      /* ignore */
    }
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="flex shrink-0 items-center gap-2.5 rounded-[var(--r-md)] border border-[color-mix(in_srgb,var(--brand)_25%,transparent)] bg-[var(--brand-soft)] px-3 py-2.5">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--surface)] text-[var(--brand)] shadow-[var(--sh-sm)]">
        <Lightbulb className="h-4 w-4" />
      </span>
      <p className="flex-1 text-[12.5px] leading-snug text-[var(--ink-2)]">{children}</p>
      <button
        type="button"
        onClick={dismiss}
        className="shrink-0 rounded-[var(--r-pill)] border border-[var(--brand)] bg-[var(--surface)] px-3 py-1 text-xs font-semibold text-[var(--brand-hover)] hover:bg-[var(--brand)] hover:text-white"
      >
        Entendi
      </button>
      <button type="button" aria-label="Fechar dica" onClick={dismiss} className="shrink-0 text-[var(--ink-3)] hover:text-[var(--ink)] lg:hidden">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
