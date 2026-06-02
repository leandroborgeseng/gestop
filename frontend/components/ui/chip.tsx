'use client';

import { cn } from '@/lib/cn';

const variants = {
  default: 'border-[var(--line)] bg-[var(--surface)] text-[var(--ink-2)] hover:border-[#cdd8e6] hover:bg-[var(--surface-2)]',
  brand: 'border-[var(--line)] bg-[var(--surface)] text-[var(--ink-2)]',
  success: 'border-[var(--ok-bd)] bg-[var(--ok-bg)] text-[var(--ok)]',
  warning: 'border-[var(--warn-bd)] bg-[var(--warn-bg)] text-[var(--warn)]',
  danger: 'border-[var(--danger-bd)] bg-[var(--danger-bg)] text-[var(--danger)]',
  accent: 'bg-[var(--brand-soft)] text-[var(--brand-hover)]',
} as const;

export function Chip({
  className,
  variant = 'default',
  active = false,
  count,
  dotColor,
  onClick,
  children,
}: {
  className?: string;
  variant?: keyof typeof variants;
  active?: boolean;
  count?: number;
  dotColor?: string;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  const Tag = onClick ? 'button' : 'span';

  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={cn(
        'inline-flex h-[30px] items-center gap-1.5 rounded-[var(--r-pill)] border px-[11px] text-[12.5px] font-semibold whitespace-nowrap transition-all duration-[var(--md-duration-short)]',
        active
          ? 'border-[var(--brand)] bg-[var(--brand)] text-white'
          : variants[variant],
        onClick && 'cursor-pointer',
        className,
      )}
    >
      {dotColor ? (
        <span
          className="h-[7px] w-[7px] rounded-full"
          style={{ background: active ? '#fff' : dotColor }}
          aria-hidden
        />
      ) : null}
      {children}
      {count != null ? (
        <span className={cn('mono text-[11px] opacity-80', active && 'opacity-90')}>{count}</span>
      ) : null}
    </Tag>
  );
}
