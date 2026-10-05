import { ADMINISTRADOR_SISTEMA_NOME, permissionMatrixKey } from './permissions-catalog';

/**
 * Paridade com o PermissionsGuard de POST /documentos/:id/assinatura
 * (`RequireAnyPermissions('documentos.coletar_assinatura', 'documentos.administrar')`).
 * Bypass só para Administrador do Sistema. `usuarios.gerenciar` sozinho toma 403.
 * Chaves de matriz `coletar_assinatura.executar` e `administrar.{alterar,excluir,executar}`
 * expandem no guard para as chaves legadas equivalentes.
 */
export function canColetarAssinatura(
  permissoes: string[],
  user?: { perfilAtivo?: { nome?: string } | null; perfis?: string[] } | null,
) {
  const perfilNome = user?.perfilAtivo?.nome ?? user?.perfis?.[0];
  if (perfilNome === ADMINISTRADOR_SISTEMA_NOME || Boolean(user?.perfis?.includes(ADMINISTRADOR_SISTEMA_NOME))) {
    return true;
  }
  if (permissoes.includes('documentos.administrar') || permissoes.includes('documentos.coletar_assinatura')) {
    return true;
  }
  if (permissoes.includes(permissionMatrixKey('documentos', 'coletar_assinatura', 'executar'))) {
    return true;
  }
  return (
    permissoes.includes(permissionMatrixKey('documentos', 'administrar', 'alterar')) ||
    permissoes.includes(permissionMatrixKey('documentos', 'administrar', 'excluir')) ||
    permissoes.includes(permissionMatrixKey('documentos', 'administrar', 'executar'))
  );
}
