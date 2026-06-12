import { ForbiddenException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { JwtPayload } from './jwt';

/** Administrador do sistema — visão global. */
export function isGlobalOperator(user: JwtPayload) {
  return user.permissoes.includes('usuarios.gerenciar');
}

/** Gestor de Secretaria — operações limitadas à pasta do usuário. */
export function isSecretariaScoped(user: JwtPayload) {
  return user.permissoes.includes('secretaria.gerenciar') && Boolean(user.secretariaId?.trim());
}

export function resolveSecretariaScopeId(user: JwtPayload): string | undefined {
  if (isSecretariaScoped(user)) return user.secretariaId!.trim();
  return undefined;
}

export function resolveChamadoSecretariaFilter(user: JwtPayload): Prisma.ChamadoWhereInput {
  const secretariaId = resolveSecretariaScopeId(user);
  return secretariaId ? { secretariaId } : {};
}

export function resolveEquipeSecretariaFilter(user: JwtPayload): Prisma.EquipeWhereInput {
  const secretariaId = resolveSecretariaScopeId(user);
  return secretariaId ? { secretariaId } : {};
}

export function resolveUnidadeSecretariaFilter(user: JwtPayload): Prisma.UnidadePublicaWhereInput {
  const secretariaId = resolveSecretariaScopeId(user);
  return secretariaId ? { secretariaId } : {};
}

export function assertChamadoSecretariaAccess(user: JwtPayload, chamado: { secretariaId: string }) {
  if (isGlobalOperator(user)) return;

  const scopeId = resolveSecretariaScopeId(user);
  if (scopeId && chamado.secretariaId === scopeId) return;

  if (scopeId) {
    throw new ForbiddenException('Chamado fora da secretaria autorizada.');
  }
}
