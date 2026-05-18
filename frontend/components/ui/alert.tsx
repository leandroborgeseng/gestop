import { AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import { cn } from '@/lib/cn';

const variants = {
  info: {
    className: 'border-[color-mix(in_srgb,var(--color-brand-primary)_20%,transparent)] bg-[var(--color-brand-primary-subtle)] text-[var(--color-brand-primary)]',
    icon: Info,
  },
  success: {
    className: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    icon: CheckCircle2,
  },
  warning: {
    className: 'border-amber-200 bg-amber-50 text-amber-800',
    icon: AlertTriangle,
  },
  error: {
    className: 'border-red-200 bg-red-50 text-red-800',
    icon: AlertTriangle,
  },
} as const;

export function Alert({
  variant = 'info',
  title,
  children,
  className,
}: {
  variant?: keyof typeof variants;
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  const config = variants[variant];
  const Icon = config.icon;

  return (
    <div
      role="alert"
      className={cn(
        'flex items-start gap-3 rounded-[var(--md-shape-md)] border px-4 py-3 md-body-md',
        config.className,
        className,
      )}
    >
      <Icon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1">
        {title ? <p className="md-label-lg">{title}</p> : null}
        <div className={cn(title ? 'mt-1' : undefined)}>{children}</div>
      </div>
    </div>
  );
}
