import { cn } from '@/lib/cn';

const variants = {
  default: 'bg-[var(--md-surface-container-high)] text-[var(--md-on-surface-variant)]',
  success: 'bg-emerald-50 text-emerald-700',
  warning: 'bg-amber-50 text-amber-700',
  danger: 'bg-red-50 text-red-700',
  brand: 'bg-[var(--color-brand-primary-subtle)] text-[var(--color-brand-primary)]',
  muted: 'bg-[var(--md-surface-container-low)] text-[var(--md-on-surface-variant)]',
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
        'inline-flex min-h-7 items-center rounded-[var(--md-shape-full)] px-2.5 py-1 md-label-md font-medium',
        variants[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}
