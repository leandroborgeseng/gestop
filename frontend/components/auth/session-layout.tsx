'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getMe, getStoredAuth, setStoredAuth, StoredAuth } from '@/lib/api';
import { AUTH_EXPIRED_EVENT } from '@/lib/security';
import { AppShell } from '@/components/layout/app-shell';
import { GuideProvider } from '@/components/help/guide-provider';
import { PwaUpdateBanner } from '@/components/pwa/pwa-update-banner';
import { PageContainer } from '@/components/layout/page-shell';
import { PageSkeleton } from '@/components/ui/skeleton';
import { registerServiceWorker } from '@/lib/pwa';

export function SessionLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [auth, setAuth] = useState<StoredAuth | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    registerServiceWorker();
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
      <AppShell userName={auth.user.nome} userRoles={auth.user.perfis} permissions={auth.user.permissoes}>
        {children}
      </AppShell>
      <PwaUpdateBanner />
    </GuideProvider>
  );
}
