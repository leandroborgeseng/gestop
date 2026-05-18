'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getStoredAuth, StoredAuth } from '@/lib/api';
import { AppShell } from '@/components/layout/app-shell';
import { PageContainer } from '@/components/layout/page-shell';
import { PageSkeleton } from '@/components/ui/skeleton';

export function SessionLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [auth, setAuth] = useState<StoredAuth | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const stored = getStoredAuth();

    if (!stored) {
      router.replace('/login?reason=expired');
      return;
    }

    setAuth(stored);
    setChecking(false);
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
    <AppShell
      userName={auth.user.nome}
      userRoles={auth.user.perfis}
      permissions={auth.user.permissoes}
    >
      {children}
    </AppShell>
  );
}
