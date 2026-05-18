import { forwardRef, type SelectHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        'flex h-12 w-full appearance-none rounded-2xl border border-[var(--color-border-subtle)] bg-white px-4 text-base text-[var(--color-text-primary)] shadow-sm transition-all duration-200 focus:border-[var(--color-brand-primary)] focus:outline-none focus:ring-4 focus:ring-[color-mix(in_srgb,var(--color-brand-primary)_12%,transparent)] disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
        className,
      )}
      {...props}
    />
  ),
);

Select.displayName = 'Select';
