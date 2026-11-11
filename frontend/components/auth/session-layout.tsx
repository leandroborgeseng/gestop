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
import { prepararSessaoAoAbrir, revalidarSessaoNaRetomada } from '@/lib/sessao-renovacao';
import { sanitizeReturnTo } from '@/lib/tela-inicial';

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
      const params = new URLSearchParams({ reason: 'expired' });
      const returnTo = sanitizeReturnTo(`${window.location.pathname}${window.location.search}`);
      if (returnTo) params.set('returnTo', returnTo);
      router.replace(`/login?${params.toString()}`);
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

    let cancelado = false;
    // 322: na abertura, renova se faltarem menos de 7 dias. Isso não troca a rota.
    void (async () => {
      await prepararSessaoAoAbrir();
      if (cancelado) return;
      const base = getStoredAuth();
      if (!base) {
        redirectToLogin();
        return;
      }
      try {
        const user = await getMe();
        if (cancelado) return;
        const refreshed: StoredAuth = { ...base, user };
        setStoredAuth(refreshed);
        setAuth(refreshed);
        setChecking(false);
      } catch {
        if (cancelado) return;
        // Rede/offline: mantém sessão local para PWA de vistoria. 401 já limpa o storage.
        const stillStored = getStoredAuth();
        if (stillStored) {
          setAuth(stillStored);
          setChecking(false);
          return;
        }
        redirectToLogin();
      }
    })();

    return () => {
      cancelado = true;
      window.removeEventListener(AUTH_EXPIRED_EVENT, onAuthExpired);
    };
  }, [router]);

  // 322 L3: retomada (visível, foco, pageshow com ou sem bfcache) revalida ou renova o token
  // da sessão de 30 dias. Não chama o router — a URL da tela atual permanece.
  useEffect(() => {
    let cancelado = false;

    const aoRetomar = () => {
      void revalidarSessaoNaRetomada().then(() => {
        if (cancelado) return;
        const stored = getStoredAuth();
        if (!stored) return;
        setAuth((atual) => {
          if (
            atual &&
            atual.accessToken === stored.accessToken &&
            atual.expiresAt === stored.expiresAt &&
            JSON.stringify(atual.user) === JSON.stringify(stored.user)
          ) {
            return atual;
          }
          return stored;
        });
      });
    };

    const onVisibilidade = () => {
      if (document.visibilityState === 'visible') aoRetomar();
    };
    const onFoco = () => aoRetomar();
    const onPageShow = (event: PageTransitionEvent) => {
      // event.persisted cobre a volta do bfcache. A rota não é reescrita.
      void event.persisted;
      aoRetomar();
    };

    document.addEventListener('visibilitychange', onVisibilidade);
    window.addEventListener('focus', onFoco);
    window.addEventListener('pageshow', onPageShow);
    return () => {
      cancelado = true;
      document.removeEventListener('visibilitychange', onVisibilidade);
      window.removeEventListener('focus', onFoco);
      window.removeEventListener('pageshow', onPageShow);
    };
  }, []);

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
