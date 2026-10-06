import { isAdministradorSistemaAtivo } from './administrador-sistema';

function matriz(telaId: string, funcaoId: string, acao: string) {
  return `matriz.${telaId}.${funcaoId}.${acao}`;
}

/**
 * Paridade com o PermissionsGuard de POST /documentos/:id/assinatura
 * (`RequireAnyPermissions('documentos.coletar_assinatura', 'documentos.administrar')`).
 * Bypass só com Administrador do Sistema ativo — `usuarios.gerenciar` sozinho toma 403.
 */
export function canColetarAssinatura(
  permissoes: string[],
  user?: { perfilAtivo?: { nome?: string } | null; perfis?: string[] } | null,
) {
  if (isAdministradorSistemaAtivo(user)) return true;
  if (permissoes.includes('documentos.administrar') || permissoes.includes('documentos.coletar_assinatura')) {
    return true;
  }
  if (permissoes.includes(matriz('documentos', 'coletar_assinatura', 'executar'))) {
    return true;
  }
  return (
    permissoes.includes(matriz('documentos', 'administrar', 'alterar')) ||
    permissoes.includes(matriz('documentos', 'administrar', 'excluir')) ||
    permissoes.includes(matriz('documentos', 'administrar', 'executar'))
  );
}
