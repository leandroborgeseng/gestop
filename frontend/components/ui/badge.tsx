import { cn } from '@/lib/cn';

const variants = {
  default: 'bg-zinc-100 text-zinc-700 ring-zinc-200',
  success: 'bg-emerald-50 text-emerald-700 ring-emerald-600/15',
  warning: 'bg-amber-50 text-amber-700 ring-amber-600/15',
  danger: 'bg-red-50 text-red-700 ring-red-600/15',
  brand: 'bg-blue-50 text-blue-700 ring-blue-600/15',
  muted: 'bg-zinc-50 text-zinc-600 ring-zinc-200',
} as const;

export function Badge({
  className,
  variant = 'default',
  children,
}: {
  className?: string;
  variant?: keyof typeof variants;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset',
        variants[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}
