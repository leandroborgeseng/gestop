import { cn } from '@/lib/cn';

const variants = {
  default: 'bg-[var(--color-bg-muted)] text-[var(--color-text-secondary)] ring-[var(--color-border-subtle)]',
  success: 'bg-emerald-50 text-emerald-700 ring-emerald-600/15',
  warning: 'bg-amber-50 text-amber-700 ring-amber-600/15',
  danger: 'bg-red-50 text-red-700 ring-red-600/15',
  brand: 'bg-[var(--color-brand-primary-subtle)] text-[var(--color-brand-primary)] ring-[color-mix(in_srgb,var(--color-brand-primary)_15%,transparent)]',
  muted: 'bg-[var(--color-bg-muted)] text-[var(--color-text-secondary)] ring-[var(--color-border-subtle)]',
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
        'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset',
        variants[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}
