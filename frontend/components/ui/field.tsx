import { cn } from '@/lib/cn';

export function Label({
  className,
  children,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label className={cn('text-[12px] font-semibold text-[var(--ink-2)]', className)} {...props}>
      {children}
    </label>
  );
}

export function Field({
  label,
  children,
  className,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
  hint?: string;
}) {
  return (
    <div className={cn('flex flex-col gap-[5px]', className)}>
      <Label>{label}</Label>
      {children}
      {hint ? <p className="text-[11.5px] text-[var(--ink-3)]">{hint}</p> : null}
    </div>
  );
}
