import { cn } from '@/lib/cn';

export function Label({
  className,
  children,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label className={cn('md-label-lg text-[var(--md-on-surface)]', className)} {...props}>
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
    <div className={cn('flex flex-col gap-2', className)}>
      <Label>{label}</Label>
      {children}
      {hint ? <p className="md-body-md text-[var(--md-on-surface-variant)]">{hint}</p> : null}
    </div>
  );
}
