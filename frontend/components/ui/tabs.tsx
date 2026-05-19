'use client';

import { cn } from '@/lib/cn';

export function Tabs({
  items,
  value,
  onChange,
  className,
}: {
  items: Array<{ id: string; label: string; icon?: React.ReactNode }>;
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex gap-1 overflow-x-auto rounded-[var(--md-shape-lg)] bg-[var(--md-surface-container)] p-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
        className,
      )}
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
              'inline-flex min-h-11 shrink-0 items-center gap-2 rounded-[var(--md-shape-md)] px-4 md-label-lg transition-all duration-[var(--md-duration-short)]',
              active
                ? 'bg-[var(--md-surface)] text-[var(--color-brand-primary)] shadow-[var(--md-elevation-1)]'
                : 'text-[var(--md-on-surface-variant)] hover:bg-[var(--md-surface-container-high)] hover:text-[var(--md-on-surface)]',
            )}
          >
            {item.icon}
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
