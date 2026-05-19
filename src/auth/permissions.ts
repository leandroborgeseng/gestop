import { SetMetadata } from '@nestjs/common';
import { JwtPayload } from './jwt';

export const REQUIRED_PERMISSIONS_KEY = 'requiredPermissions';

export function RequirePermissions(...permissions: string[]) {
  return SetMetadata(REQUIRED_PERMISSIONS_KEY, permissions);
}

export function hasAllPermissions(user: Pick<JwtPayload, 'permissoes'> | undefined, permissions: string[]) {
  if (!user) {
    return false;
  }

  return permissions.every((permission) => user.permissoes.includes(permission));
}
