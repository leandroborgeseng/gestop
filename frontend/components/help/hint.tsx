'use client';

import { cn } from '@/lib/cn';

export function Hint({ text, className }: { text: string; className?: string }) {
  return (
    <span className={cn('group relative inline-flex items-center', className)}>
      <span
        className="flex h-[15px] w-[15px] cursor-help items-center justify-center rounded-full bg-[var(--muted-bg)] text-[10px] font-bold text-[var(--ink-3)] group-hover:bg-[var(--brand-soft)] group-hover:text-[var(--brand)]"
        tabIndex={0}
        aria-label={text}
      >
        ?
      </span>
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-[calc(100%+8px)] left-1/2 z-50 w-[200px] -translate-x-1/2 rounded-lg bg-[var(--ink)] px-2.5 py-2 text-[11.5px] leading-snug font-medium text-white opacity-0 shadow-[var(--sh-md)] transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
      >
        {text}
      </span>
    </span>
  );
}
