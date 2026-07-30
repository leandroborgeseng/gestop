'use client';

import { Chip } from '@/components/ui/chip';
import { cn } from '@/lib/cn';

export type FilterMultiSelectOption = {
  value: string;
  label: string;
};

const SELECT_CLASS =
  'h-9 w-full min-w-0 max-w-full rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--surface)] px-2 text-xs';

/**
 * Dropdown (valor vazio adiciona à lista) + chips com remoção individual.
 * Mesmo padrão usado em "Tipo de chamado", reaproveitado para os demais filtros multi-seleção da CCO.
 */
export function FilterMultiSelect({
  label,
  placeholder,
  options,
  selected,
  onChange,
  className,
  selectClassName,
}: {
  label?: string;
  placeholder: string;
  options: FilterMultiSelectOption[];
  selected: string[];
  onChange: (next: string[] | undefined) => void;
  className?: string;
  selectClassName?: string;
}) {
  const available = options.filter((option) => !selected.includes(option.value));

  function add(value: string) {
    if (!value || selected.includes(value)) return;
    onChange([...selected, value]);
  }

  function remove(value: string) {
    const next = selected.filter((item) => item !== value);
    onChange(next.length ? next : undefined);
  }

  return (
    <div className={cn('min-w-0', className)}>
      {label ? (
        <div className="mb-1 flex items-center justify-between gap-2 text-[11px] font-semibold text-[var(--ink-3)]">
          <span>{label}</span>
          {selected.length ? (
            <button type="button" className="text-[var(--brand)] hover:underline" onClick={() => onChange(undefined)}>
              Limpar
            </button>
          ) : (
            <span>Nenhum selecionado</span>
          )}
        </div>
      ) : null}
      <select
        value=""
        onChange={(event) => add(event.target.value)}
        className={cn(SELECT_CLASS, selectClassName)}
      >
        <option value="">
          {available.length ? placeholder : options.length ? 'Todos já selecionados' : 'Nenhuma opção disponível'}
        </option>
        {available.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {selected.length ? (
        <div className="mt-2 flex min-w-0 flex-wrap gap-1.5">
          {selected.map((value) => {
            const option = options.find((item) => item.value === value);
            return (
              <Chip key={value} active onClick={() => remove(value)}>
                {option?.label ?? value} ×
              </Chip>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
