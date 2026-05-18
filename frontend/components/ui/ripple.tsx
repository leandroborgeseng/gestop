'use client';

import { useCallback, useRef, type PointerEvent, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

export function useRipple() {
  const hostRef = useRef<HTMLSpanElement>(null);

  const onPointerDown = useCallback((event: PointerEvent<HTMLElement>) => {
    const host = hostRef.current?.parentElement;
    if (!host || event.button !== 0) return;

    const rect = host.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height) * 1.2;
    const ripple = document.createElement('span');
    ripple.className = 'md-ripple';
    ripple.style.width = `${size}px`;
    ripple.style.height = `${size}px`;
    ripple.style.left = `${event.clientX - rect.left - size / 2}px`;
    ripple.style.top = `${event.clientY - rect.top - size / 2}px`;

    hostRef.current?.appendChild(ripple);
    ripple.addEventListener('animationend', () => ripple.remove(), { once: true });
  }, []);

  return { rippleRef: hostRef, onPointerDown };
}

export function RippleHost({ className, children }: { className?: string; children: ReactNode }) {
  const { rippleRef, onPointerDown } = useRipple();

  return (
    <span
      className={cn('md-ripple-host inline-flex', className)}
      onPointerDown={onPointerDown}
    >
      {children}
      <span ref={rippleRef} aria-hidden className="pointer-events-none absolute inset-0" />
    </span>
  );
}
