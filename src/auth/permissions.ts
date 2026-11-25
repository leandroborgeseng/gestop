import { SetMetadata } from '@nestjs/common';
import { isMatrixPermissionKey } from '../domain/permissions-catalog';
import { deriveLegacyPermissionKeys } from '../domain/permissions-matrix';
import { JwtPayload } from './jwt';

/**
 * Perfil ativo Administrador do Sistema: acesso total, sem depender da matriz.
 * 285: decidido pelo flag `Perfil.administradorSistema` do perfil ATIVO (preenchido pelo
 * AuthGuard a partir do banco), nunca pelo nome do perfil.
 */
export function isAdministradorSistema(user?: Pick<JwtPayload, 'perfis'> | null) {
  return (user as Pick<JwtPayload, 'administradorSistema'> | null | undefined)?.administradorSistema === true;
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

  const propriosFine = propriosMatrixKeysRequired(permissions);
  if (propriosFine.length > 0 && user.permissoes.some((key) => key.startsWith(PROPRIOS_MATRIX_PREFIX))) {
    // Só nas rotas de Próprios: perfil com qualquer `matriz.admin.proprios.*` vale pela chave fina
    // da ação, como no front. O legado `unidades.gerenciar` (derivado de qualquer escrita em
    // Próprios) não libera outra ação (#292). As demais abas da Administração seguem o legado.
    return propriosFine.some((key) => user.permissoes.includes(key));
  }

  const expanded = expandSessionPermissionKeys(user.permissoes);
  return permissions.some((permission) => expanded.has(permission) || user.permissoes.includes(permission));
}

const PROPRIOS_MATRIX_PREFIX = 'matriz.admin.proprios.';

/** Chaves finas de Próprios exigidas pela rota (`matriz.admin.proprios.<ação>`). */
function propriosMatrixKeysRequired(permissions: string[]) {
  return permissions.filter((key) => key.startsWith(PROPRIOS_MATRIX_PREFIX));
}
