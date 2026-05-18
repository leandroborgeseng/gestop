import { cn } from '@/lib/cn';

export function Card({
  className,
  children,
  elevation = 1,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { elevation?: 0 | 1 | 2 | 3 }) {
  return (
    <div
      className={cn(
        'overflow-hidden rounded-[var(--md-shape-lg)] border border-[var(--md-outline-variant)] bg-[var(--md-surface)]',
        elevation === 0 && 'shadow-none',
        elevation === 1 && 'md-elevation-1',
        elevation === 2 && 'md-elevation-2',
        elevation === 3 && 'md-elevation-3',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('flex flex-col gap-1 p-4 pb-0 sm:p-5 sm:pb-0', className)} {...props}>
      {children}
    </div>
  );
}

export function CardTitle({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2 className={cn('md-title-lg text-[var(--md-on-surface)]', className)} {...props}>
      {children}
    </h2>
  );
}

export function CardDescription({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={cn('md-body-md text-[var(--md-on-surface-variant)]', className)} {...props}>
      {children}
    </p>
  );
}

export function CardContent({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('p-4 sm:p-5', className)} {...props}>
      {children}
    </div>
  );
}

export function CardFooter({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('flex items-center gap-2 border-t border-[var(--md-outline-variant)] p-4 sm:p-5', className)} {...props}>
      {children}
    </div>
  );
}
