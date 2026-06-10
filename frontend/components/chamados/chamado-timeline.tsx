import { Check } from 'lucide-react';
import { cn } from '@/lib/cn';
import { ChamadoTimelineStep } from '@/lib/chamado-status';

export function ChamadoTimeline({ steps }: { steps: ChamadoTimelineStep[] }) {
  return (
    <div className="space-y-0">
      {steps.map((step, index) => (
        <div key={step.title} className="relative flex gap-3 pb-5 last:pb-0">
          {index < steps.length - 1 ? (
            <span
              className={cn(
                'absolute top-6 left-[11px] w-0.5 -translate-x-1/2',
                step.done ? 'bg-[var(--ok)]' : 'bg-[var(--line)]',
              )}
              style={{ height: 'calc(100% - 12px)' }}
              aria-hidden
            />
          ) : null}
          <span
            className={cn(
              'relative z-[1] flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2',
              step.done
                ? 'border-[var(--ok)] bg-[var(--ok)] text-white'
                : step.active
                  ? 'border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--brand)]'
                  : 'border-[var(--line)] bg-[var(--surface)] text-[var(--ink-3)]',
            )}
          >
            {step.done ? <Check className="h-3 w-3" strokeWidth={3} /> : <span className="h-2 w-2 rounded-full bg-current opacity-40" />}
          </span>
          <div className="min-w-0 flex-1 pt-0.5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className={cn('text-[13px] font-semibold', step.active ? 'text-[var(--brand-hover)]' : 'text-[var(--ink)]')}>
                {step.title}
              </span>
              <span className="mono text-[11px] text-[var(--ink-3)]">{step.date}</span>
            </div>
            {step.sub ? <p className="mt-0.5 text-[12px] text-[var(--ink-3)]">{step.sub}</p> : null}
          </div>
        </div>
      ))}
    </div>
  );
}
