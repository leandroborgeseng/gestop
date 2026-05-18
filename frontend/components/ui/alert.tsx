import { AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import { cn } from '@/lib/cn';

const variants = {
  info: {
    className: 'border-blue-200/80 bg-blue-50/80 text-blue-900',
    icon: Info,
  },
  success: {
    className: 'border-emerald-200/80 bg-emerald-50/80 text-emerald-900',
    icon: CheckCircle2,
  },
  warning: {
    className: 'border-amber-200/80 bg-amber-50/80 text-amber-900',
    icon: AlertTriangle,
  },
  error: {
    className: 'border-red-200/80 bg-red-50/80 text-red-900',
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
      className={cn('rounded-2xl border px-4 py-3 text-sm', config.className, className)}
    >
      <div className="flex items-start gap-3">
        <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <div>
          {title ? <p className="font-semibold">{title}</p> : null}
          <div className={cn(title ? 'mt-1' : undefined)}>{children}</div>
        </div>
      </div>
    </div>
  );
}
