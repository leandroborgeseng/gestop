import { forwardRef, type SelectHTMLAttributes } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/cn';

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <div className="relative">
      <select
        ref={ref}
        className={cn(
          'flex h-[36px] w-full appearance-none rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--surface)] py-0 pr-8 pl-[11px] text-[13px] text-[var(--ink)] transition-all duration-[var(--md-duration-short)] hover:border-[#cdd8e6] focus:border-[var(--brand)] focus:outline-none focus:shadow-[0_0_0_3px_var(--brand-soft)] disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        className="pointer-events-none absolute top-1/2 right-2.5 h-4 w-4 -translate-y-1/2 text-[var(--ink-3)]"
        aria-hidden
      />
    </div>
  ),
);

Select.displayName = 'Select';
