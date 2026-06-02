import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

const fieldClass =
  'flex h-[38px] w-full rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--surface)] px-[11px] text-[13px] text-[var(--ink)] transition-all duration-[var(--md-duration-short)] placeholder:text-[var(--ink-4)] hover:border-[#cdd8e6] focus:border-[var(--brand)] focus:bg-[var(--surface)] focus:outline-none focus:shadow-[0_0_0_3px_var(--brand-soft)] disabled:cursor-not-allowed disabled:opacity-50';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => <input ref={ref} className={cn(fieldClass, className)} {...props} />,
);

Input.displayName = 'Input';
