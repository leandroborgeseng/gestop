import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ChecklistEscopo } from '@prisma/client';
import { JwtPayload } from '../auth/jwt';
import { isAdministradorSistema } from '../auth/permissions';
import { permissionMatrixKey, type PermissionAction } from '../domain/permissions-catalog';

export type ChecklistAcao = Extract<PermissionAction, 'visualizar' | 'inserir' | 'alterar' | 'excluir'>;

export function checklistAcaoPermitida(permissoes: string[], action: ChecklistAcao) {
  const matrix = permissoes.filter((key) => key.startsWith('matriz.checklists.'));
  if (matrix.length > 0) {
    return (
      matrix.includes(permissionMatrixKey('checklists', '_tela', action)) ||
      matrix.includes(permissionMatrixKey('checklists', 'gerenciar', action))
    );
  }
  return permissoes.includes('checklists.gerenciar');
}

export function assertChecklistAcao(user: JwtPayload, action: ChecklistAcao) {
  if (isAdministradorSistema(user)) return;
  if (!checklistAcaoPermitida(user.permissoes ?? [], action)) {
    throw new ForbiddenException('Acesso negado para o seu perfil.');
  }
}

type ChecklistEscopoAlvo = {
  escopo: ChecklistEscopo;
  secretariaId?: string | null;
  unidade?: { secretariaId?: string | null } | null;
};

/** Edição fora de Todas as Secretarias fica no vínculo da Secretaria ativa. Checklist geral só é alterado em Todas. */
export function assertChecklistNoEscopo(user: JwtPayload, checklist: ChecklistEscopoAlvo) {
  if (!user.secretariaId) return;

  const secretariaDoVinculo = checklist.secretariaId ?? checklist.unidade?.secretariaId ?? null;
  const geral =
    checklist.escopo === ChecklistEscopo.GLOBAL ||
    (checklist.escopo === ChecklistEscopo.UNIDADE_TIPO && !checklist.secretariaId);

  if (geral) {
    throw new BadRequestException(
      'Checklist geral só pode ser alterado no contexto Todas as Secretarias.',
    );
  }

  if (secretariaDoVinculo && secretariaDoVinculo !== user.secretariaId) {
    throw new BadRequestException('Este checklist está fora da Secretaria ativa.');
  }

  if (!secretariaDoVinculo) {
    throw new BadRequestException('Este checklist está fora da Secretaria ativa.');
  }
}
