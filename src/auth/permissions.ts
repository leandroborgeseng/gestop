import { SetMetadata } from '@nestjs/common';
import { isMatrixPermissionKey } from '../domain/permissions-catalog';
import { deriveLegacyPermissionKeys } from '../domain/permissions-matrix';
import { JwtPayload } from './jwt';

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

export function hasAllPermissions(user: Pick<JwtPayload, 'permissoes'> | undefined, permissions: string[]) {
  if (!user) {
    return false;
  }

  const expanded = expandSessionPermissionKeys(user.permissoes);
  return permissions.every((permission) => expanded.has(permission) || user.permissoes.includes(permission));
}

export function hasAnyPermission(user: Pick<JwtPayload, 'permissoes'> | undefined, permissions: string[]) {
  if (!user) {
    return false;
  }

  const expanded = expandSessionPermissionKeys(user.permissoes);
  return permissions.some((permission) => expanded.has(permission) || user.permissoes.includes(permission));
}
