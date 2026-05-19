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
    <Card
      elevation={1}
      className={cn(
        'transition-all duration-[var(--md-duration-short)] hover:-translate-y-0.5 hover:shadow-[var(--md-elevation-2)]',
        className,
      )}
    >
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="md-label-lg text-[var(--md-on-surface-variant)]">{title}</p>
            <strong className="md-headline-md mt-2 block text-[var(--md-on-surface)]">{value}</strong>
            <p className="md-body-md mt-1 text-[var(--md-on-surface-variant)]">{hint}</p>
          </div>
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[var(--md-shape-md)] bg-[var(--color-brand-primary-subtle)] text-[var(--color-brand-primary)]">
            <Icon className="h-5 w-5" aria-hidden />
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
