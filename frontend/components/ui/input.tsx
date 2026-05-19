import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        'flex h-14 w-full rounded-[var(--md-shape-sm)] border border-[var(--md-outline)] bg-[var(--md-surface-container-lowest)] px-4 text-base text-[var(--md-on-surface)] shadow-none transition-all duration-[var(--md-duration-short)] placeholder:text-[var(--md-on-surface-variant)] focus:border-[var(--color-brand-primary)] focus:bg-[var(--md-surface)] focus:outline-none focus:ring-4 focus:ring-[color-mix(in_srgb,var(--color-brand-primary)_12%,transparent)] disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
        className,
      )}
      {...props}
    />
  ),
);

Input.displayName = 'Input';
