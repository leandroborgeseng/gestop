'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import { cn } from '@/lib/cn';

export type SearchableSelectOption = {
  value: string;
  label: string;
};

function normalize(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

export function SearchableSelect({
  value,
  options,
  onChange,
  placeholder = 'Selecione…',
  disabled,
  emptyLabel = 'Nenhuma opção encontrada',
  className,
}: {
  value: string;
  options: SearchableSelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  emptyLabel?: string;
  className?: string;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const selected = options.find((option) => option.value === value) ?? null;

  const filtered = useMemo(() => {
    const q = normalize(query.trim());
    if (!q) return options;
    return options.filter((option) => normalize(option.label).includes(q));
  }, [options, query]);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    }
    window.addEventListener('mousedown', onPointerDown);
    return () => window.removeEventListener('mousedown', onPointerDown);
  }, []);

  useEffect(() => {
    if (!open) setQuery('');
  }, [open]);

  return (
    <div ref={rootRef} className={cn('relative min-w-0', className)}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        className={cn(
          'flex h-10 w-full min-w-0 items-center justify-between gap-2 rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--surface)] px-3 text-left text-[13px]',
          disabled && 'cursor-not-allowed opacity-60',
          open && 'border-[var(--brand)] shadow-[0_0_0_3px_var(--brand-soft)]',
        )}
      >
        <span className={cn('min-w-0 truncate', selected ? 'text-[var(--ink)]' : 'text-[var(--ink-3)]')}>
          {selected?.label ?? placeholder}
        </span>
        <ChevronDown className={cn('h-4 w-4 shrink-0 text-[var(--ink-3)] transition-transform', open && 'rotate-180')} />
      </button>

      {open ? (
        <div className="absolute inset-x-0 z-40 mt-1 overflow-hidden rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--surface)] shadow-[var(--sh-md)]">
          <div className="relative border-b border-[var(--line-2)] p-2">
            <Search className="pointer-events-none absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2 text-[var(--ink-3)]" />
            <input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Digite para pesquisar…"
              className="h-9 w-full rounded-[var(--r-sm)] border border-[var(--line)] bg-[var(--surface)] pr-3 pl-9 text-[13px] focus:border-[var(--brand)] focus:outline-none"
            />
          </div>
          <ul className="max-h-56 overflow-y-auto overscroll-contain py-1">
            <li>
              <button
                type="button"
                className="flex w-full px-3 py-2 text-left text-[12.5px] text-[var(--ink-3)] hover:bg-[var(--surface-2)]"
                onClick={() => {
                  onChange('');
                  setOpen(false);
                }}
              >
                {placeholder}
              </button>
            </li>
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-[12px] text-[var(--ink-3)]">{emptyLabel}</li>
            ) : (
              filtered.map((option) => (
                <li key={option.value}>
                  <button
                    type="button"
                    className={cn(
                      'flex w-full px-3 py-2 text-left text-[12.5px] hover:bg-[var(--surface-2)]',
                      option.value === value && 'bg-[var(--brand-soft)] font-semibold text-[var(--brand-hover)]',
                    )}
                    onClick={() => {
                      onChange(option.value);
                      setOpen(false);
                    }}
                  >
                    <span className="min-w-0 break-words">{option.label}</span>
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
