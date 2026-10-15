import { cn } from '@/lib/cn';

const variants = {
  default: 'bg-[var(--muted-bg)] text-[var(--muted)]',
  neutral: 'bg-[var(--muted-bg)] text-[var(--muted)]',
  success: 'bg-[var(--ok-bg)] text-[var(--ok)]',
  ok: 'bg-[var(--ok-bg)] text-[var(--ok)]',
  warning: 'bg-[var(--warn-bg)] text-[var(--warn)]',
  warn: 'bg-[var(--warn-bg)] text-[var(--warn)]',
  danger: 'bg-[var(--danger-bg)] text-[var(--danger)]',
  info: 'bg-[var(--brand-soft)] text-[var(--brand-hover)]',
  brand: 'bg-[var(--brand-soft)] text-[var(--brand-hover)]',
  muted: 'bg-[var(--muted-bg)] text-[var(--muted)]',
} as const;

export function Badge({
  className,
  variant = 'default',
  children,
}: {
  className?: string;
  variant?: keyof typeof variants;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        'inline-flex min-h-7 items-center rounded-[var(--r-pill)] px-[9px] py-0.5 text-[11px] font-bold tracking-[0.01em]',
        variants[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}
