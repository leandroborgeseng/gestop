'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/cn';
import { IconButton } from '@/components/ui/icon-button';

export function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open ? (
        <>
          <motion.button
            type="button"
            aria-label="Fechar"
            className="fixed inset-0 z-[100] bg-[var(--md-on-surface)]/40 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className={cn(
              // Portal no body + z acima da bottom nav (z-40). Mobile: altura útil da tela
              // com rolagem interna; desktop: modal centrado como antes.
              'fixed inset-x-0 bottom-0 z-[110] flex max-h-[min(92dvh,calc(100dvh-0.75rem))] flex-col overflow-hidden rounded-t-[var(--md-shape-xl)] bg-[var(--md-surface)] shadow-[var(--md-elevation-5)] md:inset-x-auto md:bottom-auto md:left-1/2 md:top-1/2 md:max-h-[88vh] md:w-full md:max-w-lg md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-[var(--md-shape-xl)]',
              className,
            )}
            initial={{ y: '100%', opacity: 0.8 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0.8 }}
            transition={{ type: 'spring', damping: 32, stiffness: 380 }}
          >
            <div className="mx-auto mt-3 h-1 w-8 shrink-0 rounded-full bg-[var(--md-outline)] md:hidden" />
            <div className="flex shrink-0 items-center justify-between border-b border-[var(--md-outline-variant)] px-5 py-4">
              <h2 className="md-title-lg text-[var(--md-on-surface)]">{title}</h2>
              <IconButton variant="standard" size="sm" aria-label="Fechar" onClick={onClose}>
                <X className="h-5 w-5" />
              </IconButton>
            </div>
            <div
              className={cn(
                'min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4',
                !footer && 'pb-[max(1rem,env(safe-area-inset-bottom))]',
              )}
            >
              {children}
            </div>
            {footer ? (
              <div className="shrink-0 border-t border-[var(--md-outline-variant)] bg-[var(--md-surface)] px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                {footer}
              </div>
            ) : null}
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}
