'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSessionUser } from '@/components/auth/session-context';
import { getStoredAuth } from '@/lib/api';
import { ErrorState } from '@/components/ui-states';

export function RequirePermissions({
  permissions = [],
  match = 'all',
  children,
}: {
  permissions?: string[];
  match?: 'all' | 'any';
  children: React.ReactNode;
}) {
  const router = useRouter();
  const sessionUser = useSessionUser();
  const permissionKey = useMemo(() => `${match}:${permissions.slice().sort().join('|')}`, [match, permissions]);
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    const stored = getStoredAuth();
    const user = sessionUser ?? stored?.user;

    if (!stored && !sessionUser) {
      router.replace('/login?reason=expired');
      return;
    }

    if (!user) {
      router.replace('/login?reason=expired');
      return;
    }

    if (permissions.length === 0) {
      setAllowed(true);
      return;
    }

    const userPermissions = user.permissoes;
    const hasAccess =
      match === 'any'
        ? permissions.some((permission) => userPermissions.includes(permission))
        : permissions.every((permission) => userPermissions.includes(permission));

    if (!hasAccess) {
      router.replace('/cco?reason=denied');
      setAllowed(false);
      return;
    }

    setAllowed(true);
  }, [router, permissionKey, permissions, match, sessionUser]);

  if (allowed === null) {
    return null;
  }

  if (!allowed) {
    return <ErrorState message="Seu perfil não tem permissão para acessar esta área." />;
  }

  return children;
}
