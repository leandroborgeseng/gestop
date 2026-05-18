'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getStoredAuth } from '@/lib/api';
import { ErrorState } from '@/components/ui-states';

export function RequirePermissions({
  permissions = [],
  children,
}: {
  permissions?: string[];
  children: React.ReactNode;
}) {
  const router = useRouter();
  const permissionKey = useMemo(() => permissions.slice().sort().join('|'), [permissions]);
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    const stored = getStoredAuth();

    if (!stored) {
      router.replace('/login?reason=expired');
      return;
    }

    if (permissions.length === 0) {
      setAllowed(true);
      return;
    }

    const hasAll = permissions.every((permission) => stored.user.permissoes.includes(permission));

    if (!hasAll) {
      router.replace('/login?reason=denied');
      setAllowed(false);
      return;
    }

    setAllowed(true);
  }, [router, permissionKey, permissions]);

  if (allowed === null) {
    return null;
  }

  if (!allowed) {
    return <ErrorState message="Seu perfil não tem permissão para acessar esta área." />;
  }

  return children;
}
