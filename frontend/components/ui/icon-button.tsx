'use client';

import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

const variants = {
  standard: 'text-[var(--ink-3)] hover:bg-[var(--surface-2)] hover:text-[var(--ink)]',
  filled: 'bg-[var(--brand-soft)] text-[var(--brand)] hover:bg-[color-mix(in_srgb,var(--brand)_16%,var(--surface))]',
  tonal: 'bg-[var(--surface-2)] text-[var(--ink)] hover:bg-[var(--muted-bg)]',
  ghost: 'text-[var(--ink-3)] hover:bg-[var(--surface-2)]',
} as const;

export type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof variants;
  size?: 'sm' | 'md' | 'lg';
};

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ className, variant = 'standard', size = 'md', type = 'button', children, ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-[var(--r-md)] border border-transparent transition-colors duration-[var(--md-duration-short)] focus-visible:outline-none disabled:pointer-events-none disabled:opacity-40',
        variants[variant],
        size === 'sm' && 'h-8 w-8',
        size === 'md' && 'h-9 w-9',
        size === 'lg' && 'h-11 w-11',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  ),
);

IconButton.displayName = 'IconButton';
