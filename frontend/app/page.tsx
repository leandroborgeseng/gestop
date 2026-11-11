'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getStoredAuth } from '@/lib/api';
import { deveIrParaTelaPadrao, primeiraTelaPermitida } from '@/lib/tela-inicial';
import { PageSkeleton } from '@/components/ui/skeleton';

/** 322: `/` e o start_url do PWA escolhem a primeira tela permitida. Não é a Vistoria fixa. */
export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    if (!deveIrParaTelaPadrao('raiz', window.location.pathname)) return;

    const stored = getStoredAuth();
    if (!stored?.user) {
      router.replace('/login');
      return;
    }

    router.replace(primeiraTelaPermitida(stored.user.permissoes ?? [], stored.user));
  }, [router]);

  return (
    <main className="sigma-shell flex min-h-dvh items-center justify-center p-4">
      <div className="w-full max-w-3xl">
        <PageSkeleton />
      </div>
    </main>
  );
}
