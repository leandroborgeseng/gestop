import Link from 'next/link';
import { ArrowLeft, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Badge } from '@/components/ui/badge';

export function PageContainer({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('mx-auto w-full max-w-7xl px-4 py-5 md:px-6 md:py-8', className)}>
      {children}
    </div>
  );
}

export function PageHeader({
  kicker,
  title,
  description,
  icon: Icon,
  action,
  backHref,
}: {
  kicker?: string;
  title: string;
  description?: string;
  icon?: LucideIcon;
  action?: React.ReactNode;
  backHref?: string;
}) {
  return (
    <header className="mb-6">
      {backHref ? (
        <Link
          href={backHref}
          className="mb-4 inline-flex min-h-11 items-center gap-2 rounded-2xl px-3 text-sm font-semibold text-[var(--color-text-secondary)] transition-colors hover:bg-white hover:text-[var(--color-text-primary)]"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Link>
      ) : null}

      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl">
          {kicker ? (
            <div className="mb-3 flex items-center gap-2">
              {Icon ? <Icon className="h-4 w-4 text-[var(--color-brand-primary)]" aria-hidden /> : null}
              <Badge variant="brand">{kicker}</Badge>
            </div>
          ) : null}
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--color-text-primary)] md:text-3xl">{title}</h1>
          {description ? (
            <p className="mt-2 text-sm leading-7 text-[var(--color-text-secondary)] md:text-base">{description}</p>
          ) : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
    </header>
  );
}

export function PageShell({
  children,
  ...headerProps
}: {
  children: React.ReactNode;
  kicker?: string;
  title: string;
  description?: string;
  icon?: LucideIcon;
  action?: React.ReactNode;
  backHref?: string;
}) {
  return (
    <PageContainer>
      <PageHeader {...headerProps} />
      {children}
    </PageContainer>
  );
}
