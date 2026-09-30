'use client';

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/cn';

const VIEWPORT_MARGIN = 8;
const GAP = 8;
const MAX_WIDTH = 240;
/** Reserva a barra inferior do app no celular para o balão não cobri-la. */
const MOBILE_BOTTOM_RESERVE = 88;

type Placement = 'top' | 'bottom' | 'left' | 'right';

function prefersTouchHint() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(hover: none), (pointer: coarse)').matches;
}

function placeHint(trigger: DOMRect, tip: HTMLElement, touch: boolean) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const bottomLimit = vh - VIEWPORT_MARGIN - (touch ? MOBILE_BOTTOM_RESERVE : 0);
  const width = Math.min(MAX_WIDTH, vw - VIEWPORT_MARGIN * 2);

  tip.style.width = `${width}px`;
  const naturalHeight = tip.scrollHeight;
  const spaceAbove = trigger.top - VIEWPORT_MARGIN;
  const spaceBelow = bottomLimit - trigger.bottom;
  const spaceLeft = trigger.left - VIEWPORT_MARGIN;
  const spaceRight = vw - trigger.right - VIEWPORT_MARGIN;

  const verticalFits = (space: number) => space >= Math.min(naturalHeight + GAP, 72);
  let placement: Placement = 'top';
  if (verticalFits(spaceAbove)) placement = 'top';
  else if (verticalFits(spaceBelow)) placement = 'bottom';
  else if (spaceRight >= width + GAP) placement = 'right';
  else if (spaceLeft >= width + GAP) placement = 'left';
  else placement = spaceBelow > spaceAbove ? 'bottom' : 'top';

  let maxHeight = 220;
  let top = 0;
  let left = 0;

  if (placement === 'top' || placement === 'bottom') {
    const space = placement === 'top' ? spaceAbove : spaceBelow;
    maxHeight = Math.max(64, Math.min(220, space - GAP));
    const height = Math.min(naturalHeight, maxHeight);
    top = placement === 'top' ? trigger.top - GAP - height : trigger.bottom + GAP;
    left = trigger.left + trigger.width / 2 - width / 2;
  } else {
    maxHeight = Math.max(64, Math.min(220, bottomLimit - VIEWPORT_MARGIN));
    const height = Math.min(naturalHeight, maxHeight);
    top = trigger.top + trigger.height / 2 - height / 2;
    left = placement === 'right' ? trigger.right + GAP : trigger.left - GAP - width;
  }

  left = Math.min(Math.max(VIEWPORT_MARGIN, left), vw - width - VIEWPORT_MARGIN);
  top = Math.min(Math.max(VIEWPORT_MARGIN, top), Math.max(VIEWPORT_MARGIN, bottomLimit - Math.min(naturalHeight, maxHeight)));

  return { top, left, width, maxHeight };
}

export function Hint({ text, className }: { text: string; className?: string }) {
  const tipId = useId();
  const triggerRef = useRef<HTMLSpanElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [touchMode, setTouchMode] = useState(false);
  const [box, setBox] = useState<{ top: number; left: number; width: number; maxHeight: number } | null>(null);

  useEffect(() => {
    setMounted(true);
    setTouchMode(prefersTouchHint());
  }, []);

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    const tip = tipRef.current;
    if (!trigger || !tip) return;
    setBox(placeHint(trigger.getBoundingClientRect(), tip, prefersTouchHint()));
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
  }, [open, text, updatePosition]);

  useEffect(() => {
    if (!open) return;
    const onMove = () => updatePosition();
    window.addEventListener('scroll', onMove, true);
    window.addEventListener('resize', onMove);
    return () => {
      window.removeEventListener('scroll', onMove, true);
      window.removeEventListener('resize', onMove);
    };
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open || !touchMode) return;
    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node | null;
      if (!target) return;
      if (triggerRef.current?.contains(target) || tipRef.current?.contains(target)) return;
      setOpen(false);
    }
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open, touchMode]);

  function showFromPointer() {
    if (touchMode) return;
    setOpen(true);
  }

  function hideFromPointer() {
    if (touchMode) return;
    setOpen(false);
  }

  return (
    <span className={cn('inline-flex items-center', className)}>
      <span
        ref={triggerRef}
        role="button"
        tabIndex={0}
        aria-label="Ajuda"
        aria-describedby={open ? tipId : undefined}
        aria-expanded={open}
        className="flex h-[15px] w-[15px] cursor-help items-center justify-center rounded-full bg-[var(--muted-bg)] text-[10px] font-bold text-[var(--ink-3)] hover:bg-[var(--brand-soft)] hover:text-[var(--brand)] focus-visible:bg-[var(--brand-soft)] focus-visible:text-[var(--brand)]"
        onMouseEnter={showFromPointer}
        onMouseLeave={hideFromPointer}
        onFocus={showFromPointer}
        onBlur={(event) => {
          if (touchMode) {
            const next = event.relatedTarget as Node | null;
            if (next && tipRef.current?.contains(next)) return;
            setOpen(false);
            return;
          }
          hideFromPointer();
        }}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          if (!touchMode) return;
          setOpen((current) => !current);
        }}
        onKeyDown={(event) => {
          event.stopPropagation();
          if (event.key === 'Escape') {
            setOpen(false);
            return;
          }
          if (!touchMode) return;
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            setOpen((current) => !current);
          }
        }}
        onMouseDown={(event) => event.stopPropagation()}
      >
        ?
      </span>
      {mounted && open
        ? createPortal(
            <div
              ref={tipRef}
              id={tipId}
              role="tooltip"
              className="fixed z-[1200] overflow-y-auto rounded-lg bg-[var(--ink)] px-2.5 py-2 text-[11.5px] leading-snug font-medium break-words whitespace-normal text-white shadow-[var(--sh-md)]"
              style={{
                top: box?.top ?? -9999,
                left: box?.left ?? VIEWPORT_MARGIN,
                width: box?.width ?? MAX_WIDTH,
                maxHeight: box?.maxHeight ?? 220,
                visibility: box ? 'visible' : 'hidden',
              }}
            >
              <p>{text}</p>
              {touchMode ? (
                <button
                  type="button"
                  className="mt-2 text-[11px] font-semibold text-white/80 underline"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    setOpen(false);
                    triggerRef.current?.focus();
                  }}
                >
                  Fechar
                </button>
              ) : null}
            </div>,
            document.body,
          )
        : null}
    </span>
  );
}
