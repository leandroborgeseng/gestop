import { cn } from '@/lib/cn';

export function DataTable({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn('overflow-x-auto rounded-[var(--r-md)] border border-[var(--line)]', className)}>
      <table className="w-full min-w-[520px] border-collapse text-left text-[13px]">{children}</table>
    </div>
  );
}

export function DataTableHead({ children }: { children: React.ReactNode }) {
  return (
    <thead className="border-b border-[var(--line-2)] bg-[var(--surface-2)]">
      <tr>{children}</tr>
    </thead>
  );
}

export function DataTableHeaderCell({
  className,
  children,
  align = 'left',
}: {
  className?: string;
  children: React.ReactNode;
  align?: 'left' | 'right';
}) {
  return (
    <th
      className={cn(
        'px-3 py-2.5 text-[11px] font-bold tracking-wide text-[var(--ink-3)] uppercase',
        align === 'right' && 'text-right',
        className,
      )}
    >
      {children}
    </th>
  );
}

export function DataTableBody({ children }: { children: React.ReactNode }) {
  return <tbody className="divide-y divide-[var(--line-2)] bg-[var(--surface)]">{children}</tbody>;
}

export function DataTableRow({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return <tr className={cn('transition-colors hover:bg-[var(--surface-2)]', className)}>{children}</tr>;
}

export function DataTableCell({
  className,
  children,
  align = 'left',
  mono = false,
}: {
  className?: string;
  children: React.ReactNode;
  align?: 'left' | 'right';
  mono?: boolean;
}) {
  return (
    <td
      className={cn(
        'px-3 py-2.5 text-[var(--ink-2)]',
        align === 'right' && 'text-right',
        mono && 'mono text-[12px]',
        className,
      )}
    >
      {children}
    </td>
  );
}
