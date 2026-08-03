'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Search, X } from 'lucide-react';
import { cn } from '@/lib/cn';

export type SearchableSelectOption = {
  value: string;
  label: string;
};

type MenuGeometry = {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
};

function normalize(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function useIsCompactViewport() {
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    const media = window.matchMedia('(max-width: 639px)');
    const sync = () => setCompact(media.matches);
    sync();
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, []);

  return compact;
}

function computeDesktopGeometry(trigger: HTMLElement): MenuGeometry {
  const rect = trigger.getBoundingClientRect();
  const gap = 4;
  const viewportPadding = 8;
  const preferredMax = Math.min(360, Math.floor(window.innerHeight * 0.55));
  const spaceBelow = window.innerHeight - rect.bottom - gap - viewportPadding;
  const spaceAbove = rect.top - gap - viewportPadding;
  const placeBelow = spaceBelow >= 160 || spaceBelow >= spaceAbove;
  const maxHeight = Math.max(140, Math.min(preferredMax, placeBelow ? spaceBelow : spaceAbove));
  const top = placeBelow
    ? rect.bottom + gap
    : Math.max(viewportPadding, rect.top - gap - maxHeight);
  const width = Math.max(rect.width, 220);
  const left = Math.min(
    Math.max(viewportPadding, rect.left),
    Math.max(viewportPadding, window.innerWidth - width - viewportPadding),
  );

  return { top, left, width, maxHeight };
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
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [mounted, setMounted] = useState(false);
  const [geometry, setGeometry] = useState<MenuGeometry | null>(null);
  const compact = useIsCompactViewport();
  const selected = options.find((option) => option.value === value) ?? null;

  const filtered = useMemo(() => {
    const q = normalize(query.trim());
    if (!q) return options;
    return options.filter((option) => normalize(option.label).includes(q));
  }, [options, query]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) setQuery('');
  }, [open]);

  useEffect(() => {
    if (!open || !compact) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open, compact]);

  useLayoutEffect(() => {
    if (!open || compact) {
      setGeometry(null);
      return;
    }

    function sync() {
      if (!triggerRef.current) return;
      setGeometry(computeDesktopGeometry(triggerRef.current));
    }

    sync();
    window.addEventListener('resize', sync);
    window.addEventListener('scroll', sync, true);
    return () => {
      window.removeEventListener('resize', sync);
      window.removeEventListener('scroll', sync, true);
    };
  }, [open, compact, options.length]);

  useEffect(() => {
    if (!open) return;

    const id = window.requestAnimationFrame(() => {
      inputRef.current?.focus({ preventScroll: true });
    });

    function onPointerDown(event: MouseEvent | TouchEvent) {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) {
        return;
      }
      setOpen(false);
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      window.cancelAnimationFrame(id);
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  function selectOption(next: string) {
    onChange(next);
    setOpen(false);
  }

  function renderOptions(listClassName?: string, listStyle?: React.CSSProperties) {
    return (
      <ul
        className={cn('min-h-0 flex-1 overflow-y-auto overscroll-contain py-1', listClassName)}
        style={listStyle}
      >
        <li>
          <button
            type="button"
            className="flex w-full px-3 py-2.5 text-left text-[12.5px] text-[var(--ink-3)] hover:bg-[var(--surface-2)]"
            onClick={() => selectOption('')}
          >
            {placeholder}
          </button>
        </li>
        {filtered.length === 0 ? (
          <li className="px-3 py-3 text-[12px] text-[var(--ink-3)]">{emptyLabel}</li>
        ) : (
          filtered.map((option) => (
            <li key={option.value}>
              <button
                type="button"
                className={cn(
                  'flex w-full px-3 py-2.5 text-left text-[12.5px] hover:bg-[var(--surface-2)]',
                  option.value === value && 'bg-[var(--brand-soft)] font-semibold text-[var(--brand-hover)]',
                )}
                onClick={() => selectOption(option.value)}
              >
                <span className="min-w-0 break-words">{option.label}</span>
              </button>
            </li>
          ))
        )}
      </ul>
    );
  }

  function renderSearch() {
    return (
      <div className="relative shrink-0 border-b border-[var(--line-2)] p-2">
        <Search className="pointer-events-none absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2 text-[var(--ink-3)]" />
        <input
          ref={inputRef}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Digite para pesquisar…"
          className="h-9 w-full rounded-[var(--r-sm)] border border-[var(--line)] bg-[var(--surface)] pr-3 pl-9 text-[13px] focus:border-[var(--brand)] focus:outline-none"
        />
      </div>
    );
  }

  const portalMenu =
    mounted && open
      ? createPortal(
          compact ? (
            <div className="fixed inset-0 z-[120] flex flex-col">
              <button
                type="button"
                aria-label="Fechar lista"
                className="absolute inset-0 bg-[var(--md-on-surface,#111)]/40 backdrop-blur-[1px]"
                onClick={() => setOpen(false)}
              />
              <div
                ref={menuRef}
                role="listbox"
                className="relative z-[121] mt-auto flex max-h-[min(92dvh,calc(100dvh-env(safe-area-inset-bottom,0px)-0.75rem))] flex-col overflow-hidden rounded-t-[var(--r-card)] border border-[var(--line)] bg-[var(--surface)] shadow-[var(--sh-lg)] pb-[env(safe-area-inset-bottom,0px)]"
              >
                <div className="mx-auto mt-2 h-1 w-8 shrink-0 rounded-full bg-[var(--line)]" />
                <div className="flex shrink-0 items-center justify-between gap-2 border-b border-[var(--line-2)] px-3 py-2">
                  <p className="truncate text-[13px] font-semibold text-[var(--ink)]">
                    {selected?.label ?? placeholder}
                  </p>
                  <button
                    type="button"
                    aria-label="Fechar"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[var(--ink-3)] hover:bg-[var(--surface-2)]"
                    onClick={() => setOpen(false)}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                {renderSearch()}
                {renderOptions()}
              </div>
            </div>
          ) : geometry ? (
            <div
              ref={menuRef}
              role="listbox"
              className="fixed z-[120] flex flex-col overflow-hidden rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--surface)] shadow-[var(--sh-md)]"
              style={{
                top: geometry.top,
                left: geometry.left,
                width: geometry.width,
                maxHeight: geometry.maxHeight,
              }}
            >
              {renderSearch()}
              {renderOptions(undefined, { maxHeight: Math.max(96, geometry.maxHeight - 52) })}
            </div>
          ) : null,
          document.body,
        )
      : null;

  return (
    <div className={cn('relative min-w-0', className)}>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
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
      {portalMenu}
    </div>
  );
}
