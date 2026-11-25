/**
 * 305 — exclusão lógica de vistorias realizadas (frontend).
 * Excluir = ação Excluir da tela Vistorias realizadas; Mostrar excluídas = subfunção Visualizar excluídas.
 * O backend valida tudo de novo (403/400/404/409); aqui só controla o que aparece.
 */
import { isAdministradorSistemaAtivo } from './administrador-sistema';
import { buildMatrixKey } from './permissions-matrix';

export const VISTORIA_EXCLUIR_KEY = buildMatrixKey('vistorias', '_tela', 'excluir');
export const VISTORIA_EXCLUIDAS_VISUALIZAR_KEY = buildMatrixKey('vistorias', 'excluidas_visualizar', 'visualizar');
export const MOTIVO_EXCLUSAO_MIN = 20;
export const MOTIVO_EXCLUSAO_MAX = 1000;

type UsuarioPermissoes = {
  permissoes?: string[];
  perfilAtivo?: { nome?: string } | null;
  perfis?: string[];
} | null | undefined;

export function canExcluirVistoria(user: UsuarioPermissoes) {
  if (isAdministradorSistemaAtivo(user)) return true;
  return Boolean(user?.permissoes?.includes(VISTORIA_EXCLUIR_KEY));
}

export function canVisualizarVistoriasExcluidas(user: UsuarioPermissoes) {
  if (isAdministradorSistemaAtivo(user)) return true;
  return Boolean(user?.permissoes?.includes(VISTORIA_EXCLUIDAS_VISUALIZAR_KEY));
}

/** Mesma normalização do backend: espaços colapsados e limites de tamanho. */
export function motivoExclusaoValido(motivo: string) {
  const limpo = motivo.replace(/\s+/g, ' ').trim();
  return limpo.length >= MOTIVO_EXCLUSAO_MIN && limpo.length <= MOTIVO_EXCLUSAO_MAX;
}

/** O botão Excluir só aparece para vistoria realizada (concluída), não excluída, e com a permissão. */
export function mostrarBotaoExcluirVistoria(
  user: UsuarioPermissoes,
  vistoria: { status: string; excluida?: boolean; excluidoEm?: string | null } | null | undefined,
) {
  if (!vistoria || vistoria.excluida || vistoria.excluidoEm) return false;
  return vistoria.status === 'CONCLUIDA' && canExcluirVistoria(user);
}

export const TEXTO_EXCLUSAO_VISTORIA =
  'A vistoria deixará de aparecer na lista, nos indicadores, nas notas, no CCO, no Dashboard e nos relatórios. ' +
  'Nada é apagado: respostas, fotos, não conformidades, chamados e documentos continuam registrados. ' +
  'A programação que ela baixou não reabre; fica sinalizada.';
