'use client';

import { cn } from '@/lib/cn';
import {
  LIKERT_CATEGORIA_LABELS,
  LIKERT_CATEGORIA_TONE,
  LikertNivelDef,
  parseLikertConfig,
  resolveLikertNivel,
} from '@/lib/likert-scale';

export function LikertScale({
  opcoes,
  value,
  onChange,
  disabled = false,
  preview = false,
}: {
  opcoes: unknown;
  value?: string;
  onChange?: (nivel: LikertNivelDef) => void;
  disabled?: boolean;
  preview?: boolean;
}) {
  const niveis = parseLikertConfig(opcoes).niveis;
  const selected = resolveLikertNivel(value);

  return (
    <div
      className={cn('grid gap-2', niveis.length <= 4 ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-2 sm:grid-cols-5')}
      role={preview ? undefined : 'radiogroup'}
      aria-label={preview ? undefined : 'Escala Likert'}
    >
      {niveis.map((nivel) => {
        const isSelected = selected?.id === nivel.id;
        const tone = LIKERT_CATEGORIA_TONE[nivel.categoria];

        const content = (
          <>
            <span className="block text-[13px] font-semibold leading-tight">{nivel.label}</span>
            <span className="mt-1 block text-[11px] font-medium opacity-80">
              {nivel.pontuacao}/10 · {LIKERT_CATEGORIA_LABELS[nivel.categoria]}
            </span>
          </>
        );

        if (preview) {
          return (
            <div
              key={nivel.id}
              className={cn(
                'flex min-h-[4.5rem] flex-col items-center justify-center rounded-[var(--md-shape-md)] border px-2 text-center',
                tone,
              )}
            >
              {content}
            </div>
          );
        }

        return (
          <button
            key={nivel.id}
            type="button"
            role="radio"
            aria-checked={isSelected}
            disabled={disabled}
            onClick={() => onChange?.(nivel)}
            className={cn(
              'flex min-h-[4.5rem] flex-col items-center justify-center rounded-[var(--md-shape-md)] border px-2 text-center transition-all',
              isSelected
                ? cn(tone, 'ring-2 ring-[var(--brand)] ring-offset-2 ring-offset-[var(--surface)]')
                : 'border-[var(--line-2)] bg-[var(--surface-2)] text-[var(--ink-2)] hover:border-[var(--brand)] hover:bg-[var(--brand-soft)]',
              disabled && 'pointer-events-none opacity-60',
            )}
          >
            {content}
          </button>
        );
      })}
    </div>
  );
}
