'use client';

import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';
import { useRipple } from '@/components/ui/ripple';

const sizes = {
  md: 'h-14 gap-2 px-4 md-label-lg',
  lg: 'h-16 gap-3 px-6 md-label-lg',
  icon: 'h-14 w-14',
} as const;

export type FabProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  size?: keyof typeof sizes;
  extended?: boolean;
};

export const Fab = forwardRef<HTMLButtonElement, FabProps>(
  ({ className, size = 'icon', extended = false, type = 'button', children, onPointerDown, ...props }, ref) => {
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
          'md-ripple-host fixed bottom-[calc(5.75rem+env(safe-area-inset-bottom)+1rem)] right-4 z-20 inline-flex items-center justify-center overflow-hidden rounded-[var(--md-shape-lg)] bg-[var(--color-brand-primary-container,var(--color-brand-primary))] font-medium text-[var(--color-brand-on-primary)] shadow-[var(--md-elevation-3)] transition-all duration-[var(--md-duration-short)] hover:bg-[var(--color-brand-primary-hover)] hover:shadow-[var(--md-elevation-4)] active:scale-[0.96] focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 lg:bottom-6',
          extended ? sizes.lg : sizes[size],
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

Fab.displayName = 'Fab';
