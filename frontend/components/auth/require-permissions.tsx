'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useSessionUser } from '@/components/auth/session-context';
import { getStoredAuth } from '@/lib/api';
import {
  getDefaultAuthenticatedHref,
  hasAbrirChamado,
  hasChamadosGerenciar,
  hasMeusChamados,
  hasOperationalNavAccess,
  isNavActive,
} from '@/lib/navigation';
import { ErrorState } from '@/components/ui-states';

function permissionSatisfied(required: string, userPermissions: string[]) {
  if (required === 'chamados.gerenciar') {
    return hasChamadosGerenciar(userPermissions);
  }
  if (required === 'chamados.abrir') {
    return hasAbrirChamado(userPermissions);
  }
  if (required === 'meus_chamados.visualizar') {
    return hasMeusChamados(userPermissions);
  }
  return userPermissions.includes(required);
}

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
  const pathname = usePathname();
  const sessionUser = useSessionUser();
  const permissionKey = useMemo(() => `${match}:${permissions.slice().sort().join('|')}`, [match, permissions]);
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [noAccessMessage, setNoAccessMessage] = useState<string | null>(null);

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
      setNoAccessMessage(null);
      return;
    }

    const userPermissions = user.permissoes;
    const hasAccess =
      match === 'any'
        ? permissions.some((permission) => permissionSatisfied(permission, userPermissions))
        : permissions.every((permission) => permissionSatisfied(permission, userPermissions));

    if (!hasAccess) {
      if (!hasOperationalNavAccess(userPermissions)) {
        setAllowed(false);
        setNoAccessMessage(
          'Não há nenhuma funcionalidade liberada para o perfil atual. Procure o administrador do sistema.',
        );
        return;
      }

      const fallback = getDefaultAuthenticatedHref(userPermissions);
      // Evita loop se a rota de fallback for a mesma que acabou de negar.
      if (!isNavActive(pathname, fallback)) {
        router.replace(fallback);
        return;
      }

      setAllowed(false);
      setNoAccessMessage('Seu perfil não tem permissão para acessar esta área.');
      return;
    }

    setAllowed(true);
    setNoAccessMessage(null);
  }, [router, pathname, permissionKey, permissions, match, sessionUser]);

  if (allowed === null) {
    return null;
  }

  if (!allowed) {
    return <ErrorState message={noAccessMessage ?? 'Seu perfil não tem permissão para acessar esta área.'} />;
  }

  return children;
}
