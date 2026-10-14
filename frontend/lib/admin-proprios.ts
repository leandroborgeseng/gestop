import { buildMatrixKey, hasAdminTabAccess, type PermissionAction } from './permissions-matrix';

/** Chave única da subfunção Próprios (mesma do backend: `adminTabPermissionKeys('proprios', ...)[0]`). */
export function chaveProprios(acao: PermissionAction) {
  return buildMatrixKey('admin', 'proprios', acao);
}

export type EscopoSecretariaForm = {
  /** Secretaria ativa da sessão (null = sem secretaria ativa). */
  secretariaAtivaId: string | null;
  /** Sessão em “Todas as Secretarias”. */
  escopoTodas: boolean;
};

/** O select de Secretaria fica travado na secretaria ativa (fora do modo “Todas”). */
export function secretariaTravada(escopo: EscopoSecretariaForm) {
  return !escopo.escopoTodas && Boolean(escopo.secretariaAtivaId);
}

/**
 * Secretaria a enviar no payload. Campo `disabled` não entra no FormData
 * (`form.get` devolve `null`), e `String(null)` virava `"null"`, que o backend
 * recusava com 403. Com o select travado, envia a secretaria ativa.
 */
export function secretariaIdDoFormulario(form: Pick<FormData, 'get'>, escopo: EscopoSecretariaForm): string {
  if (secretariaTravada(escopo)) return escopo.secretariaAtivaId as string;
  const value = form.get('secretariaId');
  return typeof value === 'string' ? value.trim() : '';
}

/** O que a tela de Próprios libera para o perfil ativo, sempre pelas chaves `matriz.admin.proprios.*`. */
export function capacidadesProprios(permissoes: string[], isAdministrador = false) {
  if (isAdministrador) {
    return { podeVer: true, podeInserir: true, podeSalvar: true, podeInativar: true };
  }
  return {
    podeVer: hasAdminTabAccess('proprios', 'visualizar', permissoes),
    podeInserir: hasAdminTabAccess('proprios', 'inserir', permissoes),
    podeSalvar: hasAdminTabAccess('proprios', 'alterar', permissoes),
    podeInativar: hasAdminTabAccess('proprios', 'excluir', permissoes),
  };
}
