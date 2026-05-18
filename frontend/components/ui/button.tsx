import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

const variants = {
  primary:
    'bg-zinc-900 text-white shadow-sm hover:bg-zinc-800 active:scale-[0.98] focus-visible:ring-zinc-900/30',
  secondary:
    'bg-white text-zinc-900 ring-1 ring-zinc-200 hover:bg-zinc-50 active:scale-[0.98] focus-visible:ring-zinc-300',
  ghost: 'text-zinc-700 hover:bg-zinc-100 active:scale-[0.98] focus-visible:ring-zinc-200',
  danger:
    'bg-red-600 text-white shadow-sm hover:bg-red-700 active:scale-[0.98] focus-visible:ring-red-500/30',
  brand:
    'bg-blue-600 text-white shadow-sm hover:bg-blue-700 active:scale-[0.98] focus-visible:ring-blue-500/30',
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
