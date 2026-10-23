'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AUTH_STORAGE_KEY_PUBLICA, getMe, getStoredAuth, setStoredAuth, StoredAuth } from '@/lib/api';
import { AUTH_EXPIRED_EVENT } from '@/lib/security';
import { SessionProvider } from '@/components/auth/session-context';
import { AppShell } from '@/components/layout/app-shell';
import { GuideProvider } from '@/components/help/guide-provider';
import { PwaUpdateBanner } from '@/components/pwa/pwa-update-banner';
import { PageContainer } from '@/components/layout/page-shell';
import { PageSkeleton } from '@/components/ui/skeleton';
import { registerServiceWorker } from '@/lib/pwa';
import { emitirTrocaEscopo, SESSAO_ESCOPO_EVENT, SessaoEscopoDetail } from '@/lib/session-events';

export function SessionLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [auth, setAuth] = useState<StoredAuth | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    registerServiceWorker();
  }, []);

  // 306/S3: troca de Secretaria sem reload — atualiza o usuário do contexto (menu, seletores).
  useEffect(() => {
    function onEscopo(event: Event) {
      const { user } = (event as CustomEvent<SessaoEscopoDetail>).detail;
      setAuth((atual) => (atual ? { ...atual, user } : atual));
    }
    window.addEventListener(SESSAO_ESCOPO_EVENT, onEscopo);
    return () => window.removeEventListener(SESSAO_ESCOPO_EVENT, onEscopo);
  }, []);

  // 307/R5: troca de Secretaria feita em OUTRA aba (mesma sessão no servidor) chega aqui pelo evento
  // `storage`; repassa como troca de escopo para as telas que tratam (ex.: Cronograma com o modal aberto).
  useEffect(() => {
    function onStorage(event: StorageEvent) {
      if (event.key !== AUTH_STORAGE_KEY_PUBLICA || !event.newValue) return;
      try {
        const novo = JSON.parse(event.newValue) as StoredAuth;
        const anterior = event.oldValue ? (JSON.parse(event.oldValue) as StoredAuth) : null;
        const idNovo = novo.user?.secretariaAtiva?.id ?? null;
        const idAnterior = anterior?.user?.secretariaAtiva?.id ?? null;
        if (novo.user && idNovo !== idAnterior) emitirTrocaEscopo(novo.user);
      } catch {
        /* conteúdo inválido: ignora */
      }
    }
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  useEffect(() => {
    function redirectToLogin() {
      router.replace('/login?reason=expired');
    }

    function onAuthExpired() {
      setAuth(null);
      redirectToLogin();
    }

    window.addEventListener(AUTH_EXPIRED_EVENT, onAuthExpired);

    const stored = getStoredAuth();
    if (!stored) {
      redirectToLogin();
      return () => window.removeEventListener(AUTH_EXPIRED_EVENT, onAuthExpired);
    }

    getMe()
      .then((user) => {
        const refreshed: StoredAuth = { ...stored, user };
        setStoredAuth(refreshed);
        setAuth(refreshed);
        setChecking(false);
      })
      .catch(() => {
        // Rede/offline: mantém sessão local para PWA de vistoria. 401 já limpa o storage.
        const stillStored = getStoredAuth();
        if (stillStored) {
          setAuth(stillStored);
          setChecking(false);
          return;
        }
        redirectToLogin();
      });

    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, onAuthExpired);
  }, [router]);

  if (checking) {
    return (
      <div className="sigma-shell">
        <PageContainer>
          <PageSkeleton />
        </PageContainer>
      </div>
    );
  }

  if (!auth) {
    return null;
  }

  return (
    <GuideProvider>
      <SessionProvider user={auth.user}>
        <AppShell user={auth.user}>
          {children}
        </AppShell>
      </SessionProvider>
      <PwaUpdateBanner />
    </GuideProvider>
  );
}
