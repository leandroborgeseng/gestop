'use client';

import { cn } from '@/lib/cn';

export function Tabs({
  items,
  value,
  onChange,
  className,
}: {
  items: Array<{ id: string; label: string; icon?: React.ReactNode; count?: number }>;
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <div
      className={cn('flex gap-0.5 overflow-x-auto border-b border-[var(--line-2)]', className)}
      role="tablist"
      aria-label="Seções"
    >
      {items.map((item) => {
        const active = item.id === value;

        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(item.id)}
            className={cn(
              'relative inline-flex min-h-11 shrink-0 items-center gap-1.5 px-1 py-[11px] mr-3.5 text-[13px] font-semibold transition-colors duration-[var(--md-duration-short)]',
              active ? 'text-[var(--brand)]' : 'text-[var(--ink-3)] hover:text-[var(--ink)]',
            )}
          >
            {item.icon}
            {item.label}
            {item.count != null ? (
              <span
                className={cn(
                  'mono rounded-[var(--r-pill)] border px-1.5 text-[11px]',
                  active
                    ? 'border-transparent bg-[var(--brand-soft)] text-[var(--brand-hover)]'
                    : 'border-[var(--line)] bg-[var(--surface-2)] text-[var(--ink-3)]',
                )}
              >
                {item.count}
              </span>
            ) : null}
            {active ? (
              <span
                className="absolute right-0 bottom-0 left-0 h-0.5 rounded-t bg-[var(--brand)]"
                aria-hidden
              />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
