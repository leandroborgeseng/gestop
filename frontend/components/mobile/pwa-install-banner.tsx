'use client';

import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { bindPwaInstallPrompt, hasPwaInstallPrompt, isStandalonePwa, triggerPwaInstall } from '@/lib/pwa';

export function PwaInstallBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const unbind = bindPwaInstallPrompt();
    const timer = window.setInterval(() => {
      setVisible(hasPwaInstallPrompt() && !isStandalonePwa());
    }, 500);
    return () => {
      unbind();
      window.clearInterval(timer);
    };
  }, []);

  if (!visible) return null;

  return (
    <div className="mb-4 rounded-[var(--md-shape-md)] border border-[var(--color-brand-primary)] bg-[var(--color-brand-primary-subtle)] p-4">
      <p className="md-title-md text-[var(--color-brand-primary)]">Instalar GestOP Vistoria</p>
      <p className="md-body-md mt-1 text-[var(--color-brand-primary)] opacity-90">
        Adicione o app a tela inicial para acesso rápido offline durante vistorias.
      </p>
      <Button
        variant="filled"
        size="sm"
        className="mt-3 gap-2"
        onClick={() => triggerPwaInstall().then((ok) => ok && setVisible(false))}
      >
        <Download className="h-4 w-4" />
        Instalar app
      </Button>
    </div>
  );
}
