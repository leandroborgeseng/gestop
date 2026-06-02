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
        'overflow-hidden rounded-[var(--r-card)] border border-[var(--line)] bg-[var(--surface)]',
        elevation === 0 && 'shadow-none',
        elevation === 1 && 'shadow-[var(--sh-sm)]',
        elevation === 2 && 'shadow-[var(--sh-md)]',
        elevation === 3 && 'shadow-[var(--sh-lg)]',
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
    <div
      className={cn('flex flex-col gap-1 border-b border-[var(--line-2)] px-4 py-[13px] sm:px-4', className)}
      {...props}
    >
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
    <h2 className={cn('text-[13.5px] font-semibold text-[var(--ink)]', className)} {...props}>
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
    <p className={cn('text-[12px] text-[var(--ink-3)]', className)} {...props}>
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
    <div className={cn('p-4 sm:p-4', className)} {...props}>
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
    <div
      className={cn('flex items-center gap-2 border-t border-[var(--line-2)] p-4 sm:p-4', className)}
      {...props}
    >
      {children}
    </div>
  );
}
