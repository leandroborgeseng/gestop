'use client';

import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';
import { useRipple } from '@/components/ui/ripple';

const variants = {
  standard: 'text-[var(--md-on-surface-variant)] hover:bg-[var(--md-surface-container-high)]',
  filled: 'bg-[var(--color-brand-primary-subtle)] text-[var(--color-brand-primary)] hover:bg-[color-mix(in_srgb,var(--color-brand-primary)_18%,var(--md-surface-container-low))]',
  tonal: 'bg-[var(--md-surface-container-high)] text-[var(--md-on-surface)] hover:bg-[var(--md-surface-container-highest)]',
  ghost: 'text-[var(--md-on-surface-variant)] hover:bg-[var(--md-surface-container-low)]',
} as const;

const sizes = {
  sm: 'h-9 w-9',
  md: 'h-11 w-11',
  lg: 'h-12 w-12',
} as const;

export type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
};

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ className, variant = 'standard', size = 'md', type = 'button', children, onPointerDown, ...props }, ref) => {
    const { rippleRef, onPointerDown: handleRipple } = useRipple();

    return (
      <button
        ref={ref}
        type={type}
        onPointerDown={(event) => {
          handleRipple(event);
          onPointerDown?.(event);
        }}
        className={cn(
          'md-ripple-host relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-[var(--md-shape-full)] transition-colors duration-[var(--md-duration-short)] focus-visible:outline-none disabled:pointer-events-none disabled:opacity-40',
          variants[variant],
          sizes[size],
          className,
        )}
        {...props}
      >
        {children}
        <span ref={rippleRef} aria-hidden className="pointer-events-none absolute inset-0" />
      </button>
    );
  },
);

IconButton.displayName = 'IconButton';
