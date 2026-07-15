'use client';

import { useMemo } from 'react';
import { useSessionUser } from '@/components/auth/session-context';
import { getStoredAuth } from '@/lib/api';
import { resolvePreferredHref } from '@/lib/navigation';

/** `backHref` seguro: mantém a rota preferida só se o perfil atual puder acessá-la. */
export function useSafeBackHref(preferredHref = '/cco') {
  const sessionUser = useSessionUser();
  return useMemo(() => {
    const permissions = sessionUser?.permissoes ?? getStoredAuth()?.user.permissoes ?? [];
    return resolvePreferredHref(permissions, preferredHref);
  }, [sessionUser?.permissoes, preferredHref]);
}
