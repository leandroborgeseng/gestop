'use client';

import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';

const iconTones = {
  brand: 'bg-[var(--brand-soft)] text-[var(--brand)]',
  info: 'bg-[var(--brand-soft)] text-[var(--brand-bright)]',
  ok: 'bg-[var(--ok-bg)] text-[var(--ok)]',
  warn: 'bg-[var(--warn-bg)] text-[var(--warn)]',
} as const;

export function MetricCard({
  title,
  value,
  hint,
  delta,
  deltaTone = 'neutral',
  icon: Icon,
  active = false,
  onClick,
  className,
}: {
  title: string;
  value: number | string;
  hint?: string;
  delta?: string;
  deltaTone?: 'ok' | 'warn' | 'neutral';
  icon: LucideIcon;
  active?: boolean;
  onClick?: () => void;
  className?: string;
}) {
  const tone = active ? 'brand' : 'brand';
  const Tag = onClick ? 'button' : 'div';

  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={cn(
        'flex w-full gap-3.5 rounded-[var(--r-card)] border bg-[var(--surface)] p-4 text-left shadow-[var(--sh-sm)] transition-all duration-[var(--md-duration-short)]',
        active
          ? 'border-[var(--brand)] shadow-[0_0_0_1px_var(--brand),var(--sh-sm)]'
          : 'border-[var(--line)] hover:-translate-y-px hover:shadow-[var(--sh-md)]',
        onClick && 'cursor-pointer',
        className,
      )}
    >
      <span
        className={cn(
          'flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[10px]',
          iconTones[tone],
        )}
      >
        <Icon className="h-[18px] w-[18px]" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-medium text-[var(--ink-3)]">{title}</span>
        <span className="mt-0.5 flex flex-wrap items-baseline gap-2">
          <strong className="kpi-value">{value}</strong>
          {delta ? (
            <span
              className={cn(
                'mono text-xs font-semibold',
                deltaTone === 'ok' && 'text-[var(--ok)]',
                deltaTone === 'warn' && 'text-[var(--warn)]',
                deltaTone === 'neutral' && 'text-[var(--ink-3)]',
              )}
            >
              {delta}
            </span>
          ) : null}
        </span>
        {hint ? <span className="mt-0.5 block text-[11.5px] text-[var(--ink-4)]">{hint}</span> : null}
      </span>
    </Tag>
  );
}
