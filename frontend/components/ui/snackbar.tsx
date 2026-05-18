'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Info, AlertTriangle, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { IconButton } from '@/components/ui/icon-button';

type SnackbarVariant = 'info' | 'success' | 'warning' | 'error';

type SnackbarMessage = {
  id: string;
  message: string;
  variant: SnackbarVariant;
  duration?: number;
};

type SnackbarContextValue = {
  show: (message: string, variant?: SnackbarVariant, duration?: number) => void;
};

const SnackbarContext = createContext<SnackbarContextValue | null>(null);

const icons = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  error: AlertTriangle,
} as const;

const variantStyles = {
  info: 'bg-[var(--md-on-surface)] text-white',
  success: 'bg-emerald-700 text-white',
  warning: 'bg-amber-700 text-white',
  error: 'bg-red-700 text-white',
} as const;

export function SnackbarProvider({ children }: { children: React.ReactNode }) {
  const [queue, setQueue] = useState<SnackbarMessage[]>([]);

  const show = useCallback((message: string, variant: SnackbarVariant = 'info', duration = 4000) => {
    const id = `${Date.now()}-${Math.random()}`;
    setQueue((current) => [...current, { id, message, variant, duration }]);
  }, []);

  const dismiss = useCallback((id: string) => {
    setQueue((current) => current.filter((item) => item.id !== id));
  }, []);

  const value = useMemo(() => ({ show }), [show]);

  return (
    <SnackbarContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-[calc(5.75rem+env(safe-area-inset-bottom))] z-50 flex flex-col items-center gap-2 px-4 lg:bottom-6"
        aria-live="polite"
      >
        {queue.map((item) => (
          <SnackbarItem key={item.id} item={item} onDismiss={() => dismiss(item.id)} />
        ))}
      </div>
    </SnackbarContext.Provider>
  );
}

function SnackbarItem({ item, onDismiss }: { item: SnackbarMessage; onDismiss: () => void }) {
  const Icon = icons[item.variant];

  useEffect(() => {
    const timer = window.setTimeout(onDismiss, item.duration ?? 4000);
    return () => window.clearTimeout(timer);
  }, [item.duration, onDismiss]);

  return (
    <div
      role="status"
      className={cn(
        'md-snackbar-enter pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-[var(--md-shape-md)] px-4 py-3 shadow-[var(--md-elevation-3)]',
        variantStyles[item.variant],
      )}
    >
      <Icon className="h-5 w-5 shrink-0" aria-hidden />
      <p className="md-body-md flex-1 font-medium">{item.message}</p>
      <IconButton
        variant="ghost"
        size="sm"
        aria-label="Fechar"
        onClick={onDismiss}
        className="text-white/80 hover:bg-white/10 hover:text-white"
      >
        <X className="h-4 w-4" />
      </IconButton>
    </div>
  );
}

export function useSnackbar() {
  const context = useContext(SnackbarContext);
  if (!context) {
    throw new Error('useSnackbar must be used within SnackbarProvider');
  }
  return context;
}
