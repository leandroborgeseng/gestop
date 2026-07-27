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
      {children}
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

export function DataTableFilterRow({ children }: { children: React.ReactNode }) {
  return <tr className="border-t border-[var(--line-2)] bg-[var(--surface)]">{children}</tr>;
}

export function DataTableFilterCell({
  className,
  children,
}: {
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <th className={cn('px-2 py-2 align-top font-normal', className)}>
      {children ?? null}
    </th>
  );
}

export function DataTableTextFilter({
  value,
  onChange,
  placeholder = 'Filtrar…',
  'aria-label': ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  'aria-label'?: string;
}) {
  return (
    <input
      type="search"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      aria-label={ariaLabel ?? placeholder}
      className="w-full min-w-[5.5rem] rounded-[var(--r-sm)] border border-[var(--line)] bg-[var(--surface)] px-2 py-1.5 text-[12px] font-normal normal-case tracking-normal text-[var(--ink)] placeholder:text-[var(--ink-3)] outline-none focus:border-[var(--brand)]"
    />
  );
}

export function DataTableSelectFilter({
  value,
  onChange,
  options,
  allLabel = 'Todos',
  'aria-label': ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  allLabel?: string;
  'aria-label'?: string;
}) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      aria-label={ariaLabel ?? allLabel}
      className="w-full min-w-[5.5rem] rounded-[var(--r-sm)] border border-[var(--line)] bg-[var(--surface)] px-2 py-1.5 text-[12px] font-normal normal-case tracking-normal text-[var(--ink)] outline-none focus:border-[var(--brand)]"
    >
      <option value="">{allLabel}</option>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

export function DataTableFiltersBar({
  active,
  onClear,
  resultCount,
  totalCount,
}: {
  active: boolean;
  onClear: () => void;
  resultCount?: number;
  totalCount?: number;
}) {
  if (!active && resultCount === undefined) return null;

  return (
    <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-[12px] text-[var(--ink-3)]">
      <span>
        {resultCount !== undefined && totalCount !== undefined
          ? `${resultCount} de ${totalCount} registro(s)`
          : null}
      </span>
      {active ? (
        <button
          type="button"
          onClick={onClear}
          className="font-medium text-[var(--brand)] underline-offset-2 hover:underline"
        >
          Limpar filtros
        </button>
      ) : null}
    </div>
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
  colSpan,
}: {
  className?: string;
  children: React.ReactNode;
  align?: 'left' | 'right';
  mono?: boolean;
  colSpan?: number;
}) {
  return (
    <td
      colSpan={colSpan}
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
