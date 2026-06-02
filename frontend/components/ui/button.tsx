'use client';

import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

const variants = {
  filled:
    'bg-[var(--brand)] text-white shadow-[var(--sh-sm)] hover:bg-[var(--brand-hover)] active:brightness-95',
  tonal: 'bg-[var(--brand-soft)] text-[var(--brand-hover)] hover:bg-[color-mix(in_srgb,var(--brand)_16%,var(--surface))]',
  outlined:
    'border border-[var(--line)] bg-[var(--surface)] text-[var(--ink-2)] hover:border-[#cfd9e6] hover:bg-[var(--surface-2)] hover:text-[var(--ink)]',
  text: 'bg-transparent text-[var(--brand)] hover:bg-[var(--brand-soft)]',
  ghost: 'bg-transparent text-[var(--ink-2)] hover:bg-[var(--surface-2)] hover:text-[var(--ink)]',
  danger: 'bg-[var(--danger)] text-white shadow-[var(--sh-sm)] hover:brightness-95',
  primary:
    'bg-[var(--brand)] text-white shadow-[var(--sh-sm)] hover:bg-[var(--brand-hover)] active:brightness-95',
  secondary:
    'border border-[var(--line)] bg-[var(--surface)] text-[var(--ink-2)] hover:bg-[var(--surface-2)]',
  brand:
    'bg-[var(--brand)] text-white shadow-[var(--sh-sm)] hover:bg-[var(--brand-hover)] active:brightness-95',
} as const;

const sizes = {
  sm: 'h-8 min-h-8 px-3 text-[12.5px]',
  md: 'h-[38px] min-h-[38px] px-[15px] text-[13.5px]',
  lg: 'h-11 min-h-11 px-6 text-[13.5px]',
  icon: 'h-9 w-9 min-h-9 min-w-9 p-0',
} as const;

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'filled', size = 'md', type = 'button', children, ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(
        'inline-flex items-center justify-center gap-[7px] rounded-[var(--r-md)] font-semibold transition-all duration-[var(--md-duration-short)] focus-visible:outline-none disabled:pointer-events-none disabled:opacity-40',
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  ),
);

Button.displayName = 'Button';
