'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getStoredAuth, StoredAuth } from '@/lib/api';
import { AppShell } from '@/components/layout/app-shell';
import { PageContainer } from '@/components/layout/page-shell';
import { Skeleton } from '@/components/ui/skeleton';

export function AuthGate({
  children,
  requiredPermissions = [],
}: {
  children: React.ReactNode;
  requiredPermissions?: string[];
}) {
  const router = useRouter();
  const [auth, setAuth] = useState<StoredAuth | null>(null);
  const [checking, setChecking] = useState(true);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    const stored = getStoredAuth();

    if (!stored) {
      router.replace('/login?reason=expired');
      return;
    }

    const hasPermission = requiredPermissions.every((permission) =>
      stored.user.permissoes.includes(permission),
    );

    if (!hasPermission) {
      setDenied(true);
      router.replace('/login?reason=denied');
      return;
    }

    setAuth(stored);
    setChecking(false);
  }, [router, requiredPermissions]);

  if (checking || denied) {
    return (
      <div className="gestop-shell">
        <PageContainer>
          <div className="space-y-4 py-8">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-72" />
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <Skeleton className="h-28" />
              <Skeleton className="h-28" />
              <Skeleton className="h-28" />
              <Skeleton className="h-28" />
            </div>
            <Skeleton className="h-[420px]" />
          </div>
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
