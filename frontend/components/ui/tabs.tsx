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
        'flex gap-1 overflow-x-auto rounded-2xl bg-[var(--color-bg-muted)]/80 p-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
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
              'inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl px-4 text-sm font-semibold transition-all duration-200',
              active
                ? 'bg-white text-[var(--color-brand-primary)] shadow-sm'
                : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]',
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
