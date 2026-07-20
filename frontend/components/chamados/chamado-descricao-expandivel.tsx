'use client';

import { useState } from 'react';
import { cn } from '@/lib/cn';

const DEFAULT_COLLAPSE_AT = 180;

export function ChamadoDescricaoExpandivel({
  descricao,
  className,
  collapseAt = DEFAULT_COLLAPSE_AT,
}: {
  descricao: string;
  className?: string;
  collapseAt?: number;
}) {
  const text = descricao.trim();
  const [expanded, setExpanded] = useState(false);
  const needsCollapse = text.length > collapseAt;
  const visible = !needsCollapse || expanded ? text : `${text.slice(0, collapseAt).trimEnd()}…`;

  if (!text) return null;

  return (
    <div className={cn('text-[13px] leading-relaxed text-[var(--ink-3)]', className)}>
      <p className="whitespace-pre-wrap">{visible}</p>
      {needsCollapse ? (
        <button
          type="button"
          className="mt-1 text-[12px] font-semibold text-[var(--brand)] hover:underline"
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? 'Ver menos' : 'Ver mais'}
        </button>
      ) : null}
    </div>
  );
}
