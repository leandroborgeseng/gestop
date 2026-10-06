/** Mesmo valor de `ADMINISTRADOR_SISTEMA_NOME` em permissions-matrix.ts. */
const ADMINISTRADOR_SISTEMA_NOME = 'Administrador do Sistema';

function matriz(telaId: string, funcaoId: string, acao: string) {
  return `matriz.${telaId}.${funcaoId}.${acao}`;
}

/**
 * Igual a `isAdministradorSistemaAtivo`: perfil ativo, senão o primeiro da lista.
 * Clone local para o módulo não importar nada (imagem Docker / tsc da raiz).
 */
function isAdministradorSistemaAtivo(user?: {
  perfilAtivo?: { nome?: string } | null;
  perfis?: string[] | null;
} | null) {
  const nome = user?.perfilAtivo?.nome ?? user?.perfis?.[0];
  return nome === ADMINISTRADOR_SISTEMA_NOME;
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
