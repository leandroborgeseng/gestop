import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        'flex h-12 w-full rounded-2xl border border-[var(--color-border-subtle)] bg-white px-4 text-base text-[var(--color-text-primary)] shadow-sm transition-all duration-200 placeholder:text-[var(--color-text-secondary)] focus:border-[var(--color-brand-primary)] focus:outline-none focus:ring-4 focus:ring-[color-mix(in_srgb,var(--color-brand-primary)_12%,transparent)] disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
        className,
      )}
      {...props}
    />
  ),
);

Input.displayName = 'Input';
