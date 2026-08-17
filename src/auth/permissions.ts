import { SetMetadata } from '@nestjs/common';
import { ADMINISTRADOR_SISTEMA_NOME, isMatrixPermissionKey } from '../domain/permissions-catalog';
import { deriveLegacyPermissionKeys } from '../domain/permissions-matrix';
import { JwtPayload } from './jwt';

/** Perfil ativo Administrador do Sistema: acesso total, sem depender da matriz. */
export function isAdministradorSistema(user?: Pick<JwtPayload, 'perfis'> | null) {
  return Boolean(user?.perfis?.includes(ADMINISTRADOR_SISTEMA_NOME));
}

export const REQUIRED_PERMISSIONS_KEY = 'requiredPermissions';
export const REQUIRED_ANY_PERMISSIONS_KEY = 'requiredAnyPermissions';

export function RequirePermissions(...permissions: string[]) {
  return SetMetadata(REQUIRED_PERMISSIONS_KEY, permissions);
}

export function RequireAnyPermissions(...permissions: string[]) {
  return SetMetadata(REQUIRED_ANY_PERMISSIONS_KEY, permissions);
}

/** Expande matriz → chaves legadas para o guard (JWT pode ter só matriz.*). */
export function expandSessionPermissionKeys(permissoes: string[]) {
  const expanded = new Set(permissoes);
  const matrix = new Set(permissoes.filter(isMatrixPermissionKey));
  if (matrix.size > 0) {
    for (const key of deriveLegacyPermissionKeys(matrix)) {
      expanded.add(key);
    }
  }
  return expanded;
}

export function hasAllPermissions(
  user: Pick<JwtPayload, 'permissoes' | 'perfis'> | undefined,
  permissions: string[],
) {
  if (!user) {
    return false;
  }
  if (isAdministradorSistema(user)) {
    return true;
  }

  const expanded = expandSessionPermissionKeys(user.permissoes);
  return permissions.every((permission) => expanded.has(permission) || user.permissoes.includes(permission));
}

export function hasAnyPermission(
  user: Pick<JwtPayload, 'permissoes' | 'perfis'> | undefined,
  permissions: string[],
) {
  if (!user) {
    return false;
  }
  if (isAdministradorSistema(user)) {
    return true;
  }

  const expanded = expandSessionPermissionKeys(user.permissoes);
  return permissions.some((permission) => expanded.has(permission) || user.permissoes.includes(permission));
}
