'use client';

import { cn } from '@/lib/cn';
import { LIKERT_TONE_CLASSES, parseLikertOpcoes } from '@/lib/checklist-item-opcoes';

export function LikertScale({
  opcoes,
  value,
  onChange,
  disabled = false,
  preview = false,
}: {
  opcoes: unknown;
  value?: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
  preview?: boolean;
}) {
  const labels = parseLikertOpcoes(opcoes).opcoes;

  return (
    <div
      className={cn('grid gap-2', labels.length <= 4 ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-2 sm:grid-cols-3')}
      role={preview ? undefined : 'radiogroup'}
      aria-label={preview ? undefined : 'Escala Likert'}
    >
      {labels.map((label, index) => {
        const selected = value === label;
        const tone = LIKERT_TONE_CLASSES[index] ?? LIKERT_TONE_CLASSES[LIKERT_TONE_CLASSES.length - 1];

        if (preview) {
          return (
            <div
              key={`${label}-${index}`}
              className={cn(
                'flex min-h-14 items-center justify-center rounded-[var(--md-shape-md)] border px-2 text-center text-[13px] font-semibold',
                tone,
              )}
            >
              {label}
            </div>
          );
        }

        return (
          <button
            key={`${label}-${index}`}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            onClick={() => onChange?.(label)}
            className={cn(
              'flex min-h-14 items-center justify-center rounded-[var(--md-shape-md)] border px-2 text-center text-[13px] font-semibold transition-all',
              selected
                ? cn(tone, 'ring-2 ring-[var(--brand)] ring-offset-2 ring-offset-[var(--surface)]')
                : 'border-[var(--line-2)] bg-[var(--surface-2)] text-[var(--ink-2)] hover:border-[var(--brand)] hover:bg-[var(--brand-soft)]',
              disabled && 'pointer-events-none opacity-60',
            )}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
