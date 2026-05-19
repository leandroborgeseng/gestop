import { cn } from '@/lib/cn';

export function Table({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn('w-full overflow-x-auto rounded-[var(--md-shape-lg)]', className)}>
      <table className="w-full min-w-[640px] border-collapse text-left">{children}</table>
    </div>
  );
}

export function TableHead({ children }: { children: React.ReactNode }) {
  return (
    <thead className="border-b border-[var(--md-outline-variant)] bg-[var(--md-surface-container-low)]">
      {children}
    </thead>
  );
}

export function TableBody({ children }: { children: React.ReactNode }) {
  return <tbody className="divide-y divide-[var(--md-outline-variant)]">{children}</tbody>;
}

export function TableRow({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <tr className={cn('transition-colors hover:bg-[var(--md-surface-container-low)]', className)}>
      {children}
    </tr>
  );
}

export function TableHeader({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <th className={cn('md-label-lg px-4 py-3 font-medium text-[var(--md-on-surface-variant)]', className)}>
      {children}
    </th>
  );
}

export function TableCell({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <td className={cn('md-body-md px-4 py-3.5 text-[var(--md-on-surface)]', className)}>{children}</td>
  );
}
