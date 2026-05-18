import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/cn';

export function ListItem({
  title,
  subtitle,
  leading,
  trailing,
  href,
  onClick,
  className,
}: {
  title: string;
  subtitle?: string;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  href?: string;
  onClick?: () => void;
  className?: string;
}) {
  const content = (
    <>
      {leading ? <div className="shrink-0">{leading}</div> : null}
      <div className="min-w-0 flex-1">
        <p className="md-title-md truncate text-[var(--md-on-surface)]">{title}</p>
        {subtitle ? (
          <p className="md-body-md mt-0.5 truncate text-[var(--md-on-surface-variant)]">{subtitle}</p>
        ) : null}
      </div>
      {trailing ?? (href ? <ChevronRight className="h-5 w-5 shrink-0 text-[var(--md-on-surface-variant)]" /> : null)}
    </>
  );

  const baseClass = cn(
    'flex min-h-[4.5rem] items-center gap-4 rounded-[var(--md-shape-lg)] px-4 py-3 transition-colors duration-[var(--md-duration-short)] hover:bg-[var(--md-surface-container-low)] active:bg-[var(--md-surface-container)]',
    className,
  );

  if (href) {
    return (
      <Link href={href} className={baseClass}>
        {content}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} className={cn(baseClass, 'w-full text-left')}>
      {content}
    </button>
  );
}
