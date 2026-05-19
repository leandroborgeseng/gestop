import Link from 'next/link';
import { ArrowLeft, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Chip } from '@/components/ui/chip';

export function PageContainer({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('mx-auto w-full max-w-7xl px-4 py-4 sm:px-6 sm:py-6 lg:py-8', className)}>
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
    <header className="mb-6 sm:mb-8">
      {backHref ? (
        <Link
          href={backHref}
          className="mb-4 inline-flex min-h-11 items-center gap-2 rounded-[var(--md-shape-full)] px-2 md-label-lg text-[var(--color-brand-primary)] transition-colors hover:bg-[var(--color-brand-primary-subtle)]"
        >
          <ArrowLeft className="h-5 w-5" />
          Voltar
        </Link>
      ) : null}

      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl">
          {kicker ? (
            <div className="mb-3 flex items-center gap-2">
              {Icon ? <Icon className="h-4 w-4 text-[var(--color-brand-primary)]" aria-hidden /> : null}
              <Chip variant="brand">{kicker}</Chip>
            </div>
          ) : null}
          <h1 className="md-headline-md text-[var(--md-on-surface)] sm:md-headline-lg">{title}</h1>
          {description ? (
            <p className="md-body-lg mt-2 text-[var(--md-on-surface-variant)]">{description}</p>
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
