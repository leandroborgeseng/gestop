import { cn } from '@/lib/cn';
import { Hint } from '@/components/help/hint';

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
  tooltip,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
  hint?: string;
  tooltip?: string;
}) {
  return (
    <div className={cn('flex flex-col gap-[5px]', className)}>
      <div className="flex items-center gap-1.5">
        <Label>{label}</Label>
        {tooltip ? <Hint text={tooltip} /> : null}
      </div>
      {children}
      {hint ? <p className="text-[11.5px] text-[var(--ink-3)]">{hint}</p> : null}
    </div>
  );
}
