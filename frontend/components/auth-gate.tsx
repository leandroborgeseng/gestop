'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getStoredAuth, StoredAuth } from '@/lib/api';
import { AppShell } from '@/components/layout/app-shell';
import { PageContainer } from '@/components/layout/page-shell';
import { PageSkeleton } from '@/components/ui/skeleton';

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
