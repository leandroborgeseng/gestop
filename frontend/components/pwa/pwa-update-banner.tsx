'use client';

import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { applyPwaUpdate, subscribePwaUpdates } from '@/lib/pwa';
import { Button } from '@/components/ui/button';

export function PwaUpdateBanner() {
  const [pending, setPending] = useState(false);

  useEffect(() => subscribePwaUpdates(() => setPending(true)), []);

  if (!pending) return null;

  return (
    <div
      role="alert"
      className="fixed inset-x-3 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-[60] mx-auto flex max-w-lg flex-col gap-3 rounded-[var(--r-card)] border border-[var(--warn-bd)] bg-[var(--warn-bg)] p-4 shadow-[var(--sh-lg)] lg:bottom-6 lg:left-auto lg:right-6"
    >
      <div>
        <p className="text-[13.5px] font-semibold text-[var(--ink)]">Atualização do GestOP disponível</p>
        <p className="mt-1 text-[12.5px] text-[var(--ink-3)]">
          Você está usando uma versão antiga do app. Atualize o PWA para continuar com as funções mais recentes.
        </p>
      </div>
      <Button variant="filled" size="sm" className="w-full gap-1.5 sm:w-auto" onClick={() => void applyPwaUpdate()}>
        <RefreshCw className="h-4 w-4" />
        Atualizar agora
      </Button>
    </div>
  );
}
