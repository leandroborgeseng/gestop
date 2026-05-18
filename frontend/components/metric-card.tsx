import { LucideIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/cn';

export function MetricCard({
  title,
  value,
  hint,
  icon: Icon,
  className,
}: {
  title: string;
  value: number;
  hint: string;
  icon: LucideIcon;
  className?: string;
}) {
  return (
    <Card className={cn('transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md', className)}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-[var(--color-text-secondary)]">{title}</p>
            <strong className="mt-3 block text-3xl font-semibold tracking-tight text-[var(--color-text-primary)]">{value}</strong>
            <p className="mt-1 text-xs leading-5 text-[var(--color-text-secondary)]">{hint}</p>
          </div>
          <span className="rounded-2xl bg-[var(--color-brand-primary-subtle)] p-3 text-[var(--color-brand-primary)] ring-1 ring-[color-mix(in_srgb,var(--color-brand-primary)_12%,transparent)]">
            <Icon className="h-5 w-5" aria-hidden />
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
