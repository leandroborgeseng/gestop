import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

const variants = {
  primary:
    'bg-[var(--color-brand-primary)] text-white shadow-sm hover:bg-[var(--color-brand-primary-hover)] active:bg-[var(--color-brand-primary-active)] active:scale-[0.98] focus-visible:ring-[color-mix(in_srgb,var(--color-brand-primary)_30%,transparent)]',
  secondary:
    'bg-white text-[var(--color-text-primary)] ring-1 ring-[var(--color-border-subtle)] hover:bg-[var(--color-bg-muted)] active:scale-[0.98] focus-visible:ring-[var(--color-border-default)]',
  ghost:
    'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-muted)] hover:text-[var(--color-text-primary)] active:scale-[0.98]',
  danger:
    'bg-[var(--color-feedback-danger)] text-white shadow-sm hover:brightness-95 active:scale-[0.98] focus-visible:ring-red-500/30',
  brand:
    'bg-[var(--color-brand-primary)] text-white shadow-sm hover:bg-[var(--color-brand-primary-hover)] active:bg-[var(--color-brand-primary-active)] active:scale-[0.98] focus-visible:ring-[color-mix(in_srgb,var(--color-brand-primary)_30%,transparent)]',
} as const;

const sizes = {
  sm: 'h-9 px-3 text-sm rounded-xl',
  md: 'h-11 px-4 text-sm rounded-xl',
  lg: 'h-12 px-5 text-base rounded-2xl',
  icon: 'h-11 w-11 rounded-xl',
} as const;

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', type = 'button', ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(
        'inline-flex items-center justify-center gap-2 font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-4 disabled:pointer-events-none disabled:opacity-50',
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  ),
);

Button.displayName = 'Button';
