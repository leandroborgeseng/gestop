'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useSessionUser } from '@/components/auth/session-context';
import { getStoredAuth } from '@/lib/api';
import {
  getDefaultAuthenticatedHref,
  getVisibleNavItems,
  hasAbrirChamado,
  hasChamadosGerenciar,
  hasMeusChamados,
  hasOperationalNavAccess,
  isNavActive,
} from '@/lib/navigation';
import { sanitizeReturnTo } from '@/lib/tela-inicial';
import { isAdministradorSistemaAtivo } from '@/lib/administrador-sistema';
import { hasAnyAdminVisualizarAccess, hasChecklistAccess, hasCronogramaAccess, hasDocumentosModuloAccess } from '@/lib/permissions-matrix';
import { ErrorState } from '@/components/ui-states';

function permissionSatisfied(
  required: string,
  userPermissions: string[],
  user?: { perfilAtivo?: { nome?: string } | null; perfis?: string[] } | null,
) {
  if (isAdministradorSistemaAtivo(user)) {
    return true;
  }
  if (required === 'chamados.gerenciar') {
    return hasChamadosGerenciar(userPermissions);
  }
  if (required === 'chamados.abrir') {
    return hasAbrirChamado(userPermissions);
  }
  if (required === 'meus_chamados.visualizar') {
    return hasMeusChamados(userPermissions);
  }
  if (required === 'admin.visualizar') {
    return hasAnyAdminVisualizarAccess(userPermissions);
  }
  if (required === 'cronograma.visualizar') {
    return hasCronogramaAccess(userPermissions, 'visualizar');
  }
  if (required === 'documentos.visualizar') {
    return hasDocumentosModuloAccess(userPermissions);
  }
  if (required === 'checklists.gerenciar') {
    return hasChecklistAccess(userPermissions, 'visualizar') || userPermissions.includes('checklists.gerenciar');
  }
  return userPermissions.includes(required);
}

function hrefLogin() {
  const params = new URLSearchParams({ reason: 'expired' });
  if (typeof window !== 'undefined') {
    const returnTo = sanitizeReturnTo(`${window.location.pathname}${window.location.search}`);
    if (returnTo) params.set('returnTo', returnTo);
  }
  return `/login?${params.toString()}`;
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
      router.replace(hrefLogin());
      return;
    }

    if (!user) {
      router.replace(hrefLogin());
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
        ? permissions.some((permission) => permissionSatisfied(permission, userPermissions, user))
        : permissions.every((permission) => permissionSatisfied(permission, userPermissions, user));

    const veCco =
      (pathname === '/cco' || pathname.startsWith('/cco/')) &&
      getVisibleNavItems(userPermissions, user).some((item) => item.id === 'cco');

    // 322: quem vê o CCO no menu entra na rota, mesmo só com a chave da matriz.
    if (hasAccess || veCco) {
      setAllowed(true);
      setNoAccessMessage(null);
      return;
    }

    if (!hasOperationalNavAccess(userPermissions, user)) {
      setAllowed(false);
      setNoAccessMessage(
        'Não há nenhuma funcionalidade liberada para o perfil atual. Procure o administrador do sistema.',
      );
      return;
    }

    const fallback = getDefaultAuthenticatedHref(userPermissions, user);
    // Evita loop se a rota de fallback for a mesma que acabou de negar.
    if (!isNavActive(pathname, fallback)) {
      router.replace(fallback);
      return;
    }

    setAllowed(false);
    setNoAccessMessage('Seu perfil não tem permissão para acessar esta área.');
  }, [router, pathname, permissionKey, permissions, match, sessionUser]);

  if (allowed === null) {
    return null;
  }

  if (!allowed) {
    return <ErrorState message={noAccessMessage ?? 'Seu perfil não tem permissão para acessar esta área.'} />;
  }

  return children;
}
