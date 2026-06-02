import Link from 'next/link';
import { ArrowLeft, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';

export function PageContainer({
  children,
  className,
  flush,
}: {
  children: React.ReactNode;
  className?: string;
  flush?: boolean;
}) {
  return (
    <div
      className={cn(
        'flex min-h-0 flex-1 flex-col gap-4 overflow-hidden',
        flush ? 'p-0' : 'px-[var(--content-px)] py-[18px] pb-5',
        className,
      )}
    >
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
    <header className="shrink-0">
      {backHref ? (
        <Link
          href={backHref}
          className="mb-4 inline-flex min-h-11 items-center gap-2 rounded-[var(--r-md)] px-1 text-[13px] font-semibold text-[var(--brand)] hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Link>
      ) : null}

      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl min-w-0">
          {kicker ? (
            <div className="page-kicker mb-1 flex items-center gap-2">
              {Icon ? <Icon className="h-3.5 w-3.5" aria-hidden /> : null}
              {kicker}
            </div>
          ) : null}
          <h1 className="page-title">{title}</h1>
          {description ? <p className="mt-1 text-[13.5px] text-[var(--ink-3)]">{description}</p> : null}
        </div>
        {action ? <div className="flex shrink-0 flex-wrap gap-2">{action}</div> : null}
      </div>
    </header>
  );
}

export function PageShell({
  children,
  flush,
  className,
  ...headerProps
}: {
  children: React.ReactNode;
  kicker?: string;
  title: string;
  description?: string;
  icon?: LucideIcon;
  action?: React.ReactNode;
  backHref?: string;
  flush?: boolean;
  className?: string;
}) {
  return (
    <PageContainer flush={flush} className={className}>
      <PageHeader {...headerProps} />
      {children}
    </PageContainer>
  );
}
