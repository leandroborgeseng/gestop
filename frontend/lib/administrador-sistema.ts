export const ADMINISTRADOR_SISTEMA_NOME = 'Administrador do Sistema';

/** Perfil ativo, senão o primeiro da lista — o JWT só coloca o perfil ativo em `perfis`. */
export function isAdministradorSistemaAtivo(user?: {
  perfilAtivo?: { nome?: string } | null;
  perfis?: string[] | null;
} | null) {
  const nome = user?.perfilAtivo?.nome ?? user?.perfis?.[0];
  return nome === ADMINISTRADOR_SISTEMA_NOME;
}
