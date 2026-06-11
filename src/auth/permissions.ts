import { SetMetadata } from '@nestjs/common';
import { JwtPayload } from './jwt';

export const REQUIRED_PERMISSIONS_KEY = 'requiredPermissions';
export const REQUIRED_ANY_PERMISSIONS_KEY = 'requiredAnyPermissions';

export function RequirePermissions(...permissions: string[]) {
  return SetMetadata(REQUIRED_PERMISSIONS_KEY, permissions);
}

export function RequireAnyPermissions(...permissions: string[]) {
  return SetMetadata(REQUIRED_ANY_PERMISSIONS_KEY, permissions);
}

export function hasAllPermissions(user: Pick<JwtPayload, 'permissoes'> | undefined, permissions: string[]) {
  if (!user) {
    return false;
  }

  return permissions.every((permission) => user.permissoes.includes(permission));
}

export function hasAnyPermission(user: Pick<JwtPayload, 'permissoes'> | undefined, permissions: string[]) {
  if (!user) {
    return false;
  }

  return permissions.some((permission) => user.permissoes.includes(permission));
}
