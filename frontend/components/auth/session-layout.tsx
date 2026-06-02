'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getMe, getStoredAuth, StoredAuth } from '@/lib/api';
import { AUTH_EXPIRED_EVENT } from '@/lib/security';
import { AppShell } from '@/components/layout/app-shell';
import { PageContainer } from '@/components/layout/page-shell';
import { PageSkeleton } from '@/components/ui/skeleton';

export function SessionLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [auth, setAuth] = useState<StoredAuth | null>(null);
  const [checking, setChecking] = useState(true);

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
      <div className="gestop-shell">
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
    <AppShell userName={auth.user.nome} userRoles={auth.user.perfis} permissions={auth.user.permissoes}>
      {children}
    </AppShell>
  );
}
