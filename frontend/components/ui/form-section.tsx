import { Children } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/cn';

export function FormSection({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card elevation={1} className={cn(className)}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">{children}</CardContent>
    </Card>
  );
}

export function FormGrid({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('grid gap-6 lg:grid-cols-[minmax(0,24rem)_1fr]', className)}>
      {children}
    </div>
  );
}

export function RecordList({
  children,
  empty,
  className,
}: {
  children: React.ReactNode;
  empty?: string;
  className?: string;
}) {
  const items = Children.toArray(children);

  if (items.length === 0) {
    return (
      <p className="md-body-md py-8 text-center text-[var(--md-on-surface-variant)]">
        {empty ?? 'Nenhum registro.'}
      </p>
    );
  }

  return <div className={cn('space-y-2', className)}>{children}</div>;
}

export function RecordItem({
  title,
  subtitle,
  active,
  actions,
}: {
  title: string;
  subtitle: string;
  active: boolean;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-[var(--md-shape-md)] bg-[var(--md-surface-container-low)] p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="md-title-md text-[var(--md-on-surface)]">{title}</p>
        <p className="md-body-md mt-0.5 text-[var(--md-on-surface-variant)]">{subtitle}</p>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <span
          className={cn(
            'inline-flex min-h-7 items-center rounded-[var(--md-shape-full)] px-3 md-label-md font-medium',
            active ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700',
          )}
        >
          {active ? 'Ativo' : 'Inativo'}
        </span>
        {actions}
      </div>
    </div>
  );
}
