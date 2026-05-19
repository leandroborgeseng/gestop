'use client';

import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';
import { useRipple } from '@/components/ui/ripple';

const variants = {
  filled:
    'bg-[var(--color-brand-primary)] text-[var(--color-brand-on-primary)] shadow-[var(--md-elevation-1)] hover:bg-[var(--color-brand-primary-hover)] hover:shadow-[var(--md-elevation-2)] active:bg-[var(--color-brand-primary-active)]',
  tonal:
    'bg-[var(--color-brand-primary-subtle)] text-[var(--color-brand-primary)] hover:bg-[color-mix(in_srgb,var(--color-brand-primary)_14%,var(--md-surface-container-low))]',
  outlined:
    'border border-[var(--md-outline)] bg-transparent text-[var(--color-brand-primary)] hover:bg-[var(--color-brand-primary-subtle)]',
  text: 'bg-transparent text-[var(--color-brand-primary)] hover:bg-[var(--color-brand-primary-subtle)]',
  ghost:
    'bg-transparent text-[var(--md-on-surface-variant)] hover:bg-[var(--md-surface-container-low)] hover:text-[var(--md-on-surface)]',
  danger:
    'bg-[var(--color-feedback-danger)] text-white shadow-[var(--md-elevation-1)] hover:brightness-95',
  /* legacy aliases */
  primary:
    'bg-[var(--color-brand-primary)] text-[var(--color-brand-on-primary)] shadow-[var(--md-elevation-1)] hover:bg-[var(--color-brand-primary-hover)] hover:shadow-[var(--md-elevation-2)] active:bg-[var(--color-brand-primary-active)]',
  secondary:
    'border border-[var(--md-outline)] bg-[var(--md-surface)] text-[var(--md-on-surface)] hover:bg-[var(--md-surface-container-low)]',
  brand:
    'bg-[var(--color-brand-primary)] text-[var(--color-brand-on-primary)] shadow-[var(--md-elevation-1)] hover:bg-[var(--color-brand-primary-hover)] hover:shadow-[var(--md-elevation-2)] active:bg-[var(--color-brand-primary-active)]',
} as const;

const sizes = {
  sm: 'h-9 min-w-9 px-3 md-label-lg',
  md: 'h-11 min-w-11 px-5 md-label-lg',
  lg: 'h-12 min-w-12 px-6 md-label-lg',
  icon: 'h-11 w-11',
} as const;

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'filled', size = 'md', type = 'button', children, onPointerDown, ...props }, ref) => {
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
          'md-ripple-host relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-[var(--md-shape-full)] font-medium transition-all duration-[var(--md-duration-short)] focus-visible:outline-none disabled:pointer-events-none disabled:opacity-40',
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

Button.displayName = 'Button';
