import { cn } from '@/lib/cn';

const variants = {
  default: 'bg-[var(--md-surface-container-low)] text-[var(--md-on-surface-variant)]',
  brand: 'bg-[var(--color-brand-primary-subtle)] text-[var(--color-brand-primary)]',
  success: 'bg-emerald-50 text-emerald-700',
  warning: 'bg-amber-50 text-amber-700',
  danger: 'bg-red-50 text-red-700',
  accent: 'bg-[var(--color-brand-accent-subtle)] text-[var(--color-brand-accent)]',
} as const;

export function Chip({
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
        'inline-flex min-h-8 items-center gap-1.5 rounded-[var(--md-shape-full)] px-3 py-1 md-label-md font-medium',
        variants[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}
