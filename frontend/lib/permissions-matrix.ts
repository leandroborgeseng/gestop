export const PERMISSION_ACTIONS = ['visualizar', 'inserir', 'alterar', 'excluir', 'executar'] as const;

export type PermissionAction = (typeof PERMISSION_ACTIONS)[number];

export const PERMISSION_ACTION_LABELS: Record<PermissionAction, string> = {
  visualizar: 'Visualizar',
  inserir: 'Inserir',
  alterar: 'Alterar',
  excluir: 'Excluir',
  executar: 'Executar',
};

export type PermissionCatalogFunction = {
  id: string;
  label: string;
  actions: PermissionAction[];
};

export type PermissionCatalogScreen = {
  id: string;
  label: string;
  functions: PermissionCatalogFunction[];
};

export function buildMatrixKey(telaId: string, funcaoId: string, acao: PermissionAction) {
  return `matriz.${telaId}.${funcaoId}.${acao}`;
}

export function isMatrixPermissionKey(chave: string) {
  return chave.startsWith('matriz.');
}

export function getScreenFunctionRows(tela: PermissionCatalogScreen) {
  const screenRow = tela.functions.find((item) => item.id === '_tela');
  if (screenRow) return tela.functions;
  return [{ id: '_tela', label: tela.label, actions: [...PERMISSION_ACTIONS] }, ...tela.functions];
}

export function keysForScreenAction(tela: PermissionCatalogScreen, acao: PermissionAction) {
  return tela.functions.flatMap((funcao) =>
    funcao.actions.includes(acao) ? [buildMatrixKey(tela.id, funcao.id, acao)] : [],
  );
}

export type CheckboxAggregateState = 'none' | 'partial' | 'all';

export function screenActionState(
  chaves: Set<string>,
  tela: PermissionCatalogScreen,
  acao: PermissionAction,
): CheckboxAggregateState {
  const keys = keysForScreenAction(tela, acao);
  if (keys.length === 0) return 'none';
  const checked = keys.filter((key) => chaves.has(key)).length;
  if (checked === 0) return 'none';
  if (checked === keys.length) return 'all';
  return 'partial';
}

export function setScreenAction(
  current: Set<string>,
  tela: PermissionCatalogScreen,
  acao: PermissionAction,
  checked: boolean,
) {
  const keys = keysForScreenAction(tela, acao);
  for (const key of keys) {
    if (checked) current.add(key);
    else current.delete(key);
  }
  return current;
}

export function setFunctionAction(
  current: Set<string>,
  telaId: string,
  funcao: PermissionCatalogFunction,
  acao: PermissionAction,
  checked: boolean,
) {
  const key = buildMatrixKey(telaId, funcao.id, acao);
  if (checked) current.add(key);
  else current.delete(key);
  return current;
}

export const NAV_SCREEN_MAP: Record<string, string> = {
  cco: 'cco',
  mobile: 'vistoria_campo',
  vistorias: 'vistorias',
  chamados: 'chamados',
  novo_chamado: 'chamados',
  meus_chamados: 'meus_chamados',
  execucao: 'execucao',
  dashboard: 'dashboard',
  cronograma: 'cronograma',
  relatorios: 'relatorios',
  documentos: 'documentos',
  admin: 'admin',
  checklists: 'checklists',
  integracoes: 'integracoes',
};

const CHAMADOS_ABRIR_KEYS = new Set([
  buildMatrixKey('chamados', 'abrir_chamado', 'visualizar'),
  buildMatrixKey('chamados', 'abrir_chamado', 'inserir'),
]);

export function screenHasVisualizarAccess(telaId: string, permissoes: string[]) {
  const set = new Set(permissoes);
  return permissoes.some((key) => {
    if (!(key.startsWith(`matriz.${telaId}.`) && key.endsWith('.visualizar') && set.has(key))) {
      return false;
    }
    // Novo chamado sozinho não libera o menu Chamados.
    if (telaId === 'chamados' && CHAMADOS_ABRIR_KEYS.has(key)) return false;
    if (telaId === 'chamados' && key.includes('.tarefas')) return false;
    return true;
  });
}

export function hasAbrirChamadoAccess(permissoes: string[]) {
  if (permissoes.includes('chamados.abrir') || permissoes.includes('chamados.gerenciar')) {
    return true;
  }
  return (
    permissoes.includes(buildMatrixKey('chamados', 'abrir_chamado', 'visualizar')) ||
    permissoes.includes(buildMatrixKey('chamados', 'abrir_chamado', 'inserir'))
  );
}

export function hasMeusChamadosAccess(permissoes: string[]) {
  if (permissoes.includes('meus_chamados.visualizar')) return true;
  if (permissoes.includes('chamados.abrir') || permissoes.includes('chamados.gerenciar')) return true;
  return (
    screenHasVisualizarAccess('meus_chamados', permissoes) ||
    hasAbrirChamadoAccess(permissoes)
  );
}

export type CronogramaPermissionAction = PermissionAction;

/** Verifica ação do Cronograma (matriz + legado). */
export function hasCronogramaAccess(
  permissoes: string[],
  action: CronogramaPermissionAction = 'visualizar',
) {
  if (permissoes.includes(`cronograma.${action}`)) return true;

  if (permissoes.includes(buildMatrixKey('cronograma', '_tela', action))) return true;
  if (
    (action === 'visualizar' ||
      action === 'inserir' ||
      action === 'alterar' ||
      action === 'excluir') &&
    permissoes.includes(buildMatrixKey('cronograma', 'gerenciar', action))
  ) {
    return true;
  }
  if (
    (action === 'visualizar' || action === 'executar') &&
    permissoes.includes(buildMatrixKey('cronograma', 'cobertura', action))
  ) {
    return true;
  }

  // Legado: dashboard.visualizar liberava o módulo antes das chaves cronograma.*.
  if (action === 'visualizar' && permissoes.includes('dashboard.visualizar')) {
    return true;
  }
  if (
    (action === 'inserir' || action === 'alterar' || action === 'excluir' || action === 'executar') &&
    permissoes.includes('dashboard.visualizar') &&
    !permissoes.some(isMatrixPermissionKey)
  ) {
    return true;
  }
  // Legado operacional: criar/editar cronograma usava checklists.gerenciar.
  if (
    (action === 'inserir' || action === 'alterar' || action === 'excluir') &&
    permissoes.includes('checklists.gerenciar')
  ) {
    return true;
  }

  return false;
}

export function canGerirTarefasChamado(
  permissoes: string[],
  acao: 'visualizar' | 'inserir' | 'alterar' | 'executar' | 'excluir',
) {
  if (permissoes.includes('usuarios.gerenciar') || permissoes.includes('chamados.gerenciar')) return true;
  return permissoes.includes(buildMatrixKey('chamados', 'tarefas', acao));
}

export function canVerTarefasExecucao(permissoes: string[]) {
  if (
    permissoes.includes('usuarios.gerenciar') ||
    permissoes.includes('chamados.gerenciar') ||
    permissoes.includes('chamados.executar')
  ) {
    return true;
  }
  return (
    permissoes.includes(buildMatrixKey('execucao', 'tarefas', 'visualizar')) ||
    permissoes.includes(buildMatrixKey('chamados', 'tarefas', 'visualizar')) ||
    permissoes.includes(buildMatrixKey('chamados', 'tarefas', 'alterar')) ||
    permissoes.includes(buildMatrixKey('chamados', 'tarefas', 'executar')) ||
    permissoes.includes(buildMatrixKey('chamados', 'tarefas_andamento', 'executar')) ||
    permissoes.includes(buildMatrixKey('chamados', 'tarefas_concluir', 'executar')) ||
    permissoes.includes(buildMatrixKey('chamados', 'tarefas_historico', 'visualizar')) ||
    permissoes.includes(buildMatrixKey('chamados', 'tarefas_atribuidas', 'visualizar'))
  );
}

export function canAssinarDocumentoInterno(permissoes: string[]) {
  if (permissoes.includes('usuarios.gerenciar') || permissoes.includes('documentos.administrar')) return true;
  return (
    permissoes.includes('documentos.assinar_interno') ||
    permissoes.includes(buildMatrixKey('documentos', 'assinar_interno', 'executar'))
  );
}

export function canDisponibilizarAssinaturaInterna(permissoes: string[]) {
  if (permissoes.includes('usuarios.gerenciar') || permissoes.includes('documentos.administrar')) return true;
  return (
    permissoes.includes('documentos.disponibilizar_assinatura') ||
    permissoes.includes(buildMatrixKey('documentos', 'disponibilizar_assinatura', 'executar'))
  );
}

export { canColetarAssinatura } from './can-coletar-assinatura';

export function canCriarDocumentoAvulso(permissoes: string[]) {
  if (permissoes.includes('usuarios.gerenciar') || permissoes.includes('documentos.administrar')) return true;
  return (
    permissoes.includes('documentos.criar_avulso') ||
    permissoes.includes(buildMatrixKey('documentos', 'avulso', 'inserir')) ||
    permissoes.includes(buildMatrixKey('documentos', '_tela', 'inserir'))
  );
}

export function canVerDocumentosRelacionados(permissoes: string[]) {
  if (hasDocumentosModuloAccess(permissoes)) return true;
  return (
    permissoes.includes('documentos.gerar_pdf') ||
    permissoes.includes('dashboard.visualizar') ||
    permissoes.includes('chamados.gerenciar') ||
    permissoes.includes('chamados.abrir') ||
    permissoes.includes('meus_chamados.visualizar') ||
    permissoes.includes('fiscalizacoes.executar') ||
    permissoes.includes(buildMatrixKey('documentos', 'gerar_pdf', 'visualizar')) ||
    permissoes.includes(buildMatrixKey('documentos', 'gerar_pdf', 'executar')) ||
    permissoes.includes(buildMatrixKey('chamados', '_tela', 'visualizar')) ||
    permissoes.includes(buildMatrixKey('chamados', 'consultar_documentos', 'visualizar')) ||
    permissoes.includes(buildMatrixKey('meus_chamados', 'consultar_documentos', 'visualizar')) ||
    permissoes.includes(buildMatrixKey('execucao', '_tela', 'visualizar'))
  );
}

export function hasDocumentosModuloAccess(permissoes: string[]) {
  if (permissoes.includes('usuarios.gerenciar')) return true;
  if (permissoes.includes('documentos.visualizar') || permissoes.includes('documentos.administrar')) {
    return true;
  }
  return (
    permissoes.includes('matriz.documentos._tela.visualizar') ||
    permissoes.includes('matriz.documentos.consultar.visualizar')
  );
}

export function navItemAllowedByMatrix(itemId: string, permissoes: string[]) {
  const hasMatrix = permissoes.some(isMatrixPermissionKey);
  if (!hasMatrix) return null;

  if (itemId === 'novo_chamado') {
    return hasAbrirChamadoAccess(permissoes);
  }

  if (itemId === 'meus_chamados') {
    return hasMeusChamadosAccess(permissoes);
  }

  const telaId = NAV_SCREEN_MAP[itemId];
  if (!telaId) return null;
  return screenHasVisualizarAccess(telaId, permissoes);
}

export type AdminTabPermissionId =
  | 'secretarias'
  | 'proprios'
  | 'usuarios'
  | 'equipes'
  | 'cargos'
  | 'tipos_chamado'
  | 'tipos_proprio'
  | 'categorias_vistoria'
  | 'permissoes'
  | 'backup'
  | 'importacao'
  | 'auditoria'
  | 'email';

const ADMIN_CADASTROS_TABS: AdminTabPermissionId[] = ['secretarias', 'proprios', 'usuarios'];

const ADMIN_TAB_LEGACY: Partial<Record<AdminTabPermissionId, string[]>> = {
  secretarias: ['secretarias.gerenciar'],
  proprios: ['unidades.gerenciar'],
  usuarios: ['usuarios.gerenciar'],
  equipes: ['usuarios.gerenciar'],
  cargos: ['usuarios.gerenciar'],
  tipos_chamado: ['usuarios.gerenciar'],
  tipos_proprio: ['usuarios.gerenciar', 'unidades.gerenciar'],
  categorias_vistoria: ['checklists.gerenciar', 'usuarios.gerenciar'],
  permissoes: ['permissoes.gerenciar', 'usuarios.gerenciar'],
  backup: ['usuarios.gerenciar'],
  importacao: ['unidades.gerenciar', 'usuarios.gerenciar'],
  auditoria: ['auditoria.visualizar', 'usuarios.gerenciar'],
  email: ['usuarios.gerenciar'],
};

/** Verifica permissão de ação em uma aba da Administração (matriz fina + legado). */
export function hasAdminTabAccess(
  tab: AdminTabPermissionId,
  action: PermissionAction,
  permissoes: string[],
) {
  const hasMatrixAdmin = permissoes.some((key) => key.startsWith('matriz.admin.'));
  if (hasMatrixAdmin) {
    if (permissoes.includes(buildMatrixKey('admin', tab, action))) return true;
    if (
      ADMIN_CADASTROS_TABS.includes(tab) &&
      permissoes.includes(buildMatrixKey('admin', 'cadastros', action))
    ) {
      return true;
    }
    // Sem chave fina: não usar usuarios.gerenciar derivado para liberar todas as abas
    return false;
  }

  if (permissoes.includes('usuarios.gerenciar')) return true;
  return (ADMIN_TAB_LEGACY[tab] ?? []).some((key) => permissoes.includes(key));
}

export function hasAnyAdminVisualizarAccess(permissoes: string[]) {
  if (permissoes.includes('usuarios.gerenciar')) return true;
  if (screenHasVisualizarAccess('admin', permissoes)) return true;
  const tabs: AdminTabPermissionId[] = [
    'secretarias',
    'proprios',
    'usuarios',
    'equipes',
    'cargos',
    'tipos_chamado',
    'tipos_proprio',
    'categorias_vistoria',
    'permissoes',
    'backup',
    'importacao',
    'auditoria',
    'email',
  ];
  return tabs.some((tab) => hasAdminTabAccess(tab, 'visualizar', permissoes));
}

export const ADMINISTRADOR_SISTEMA_NOME = 'Administrador do Sistema';

export function canVisualizarChamadosExcluidos(user?: {
  permissoes?: string[];
  perfilAtivo?: { nome?: string } | null;
  perfis?: string[];
} | null) {
  if (isAdministradorSistemaAtivo(user)) return true;
  return Boolean(user?.permissoes?.includes(buildMatrixKey('chamados', 'excluidos_visualizar', 'visualizar')));
}

export function canExcluirChamadoLogicamente(user?: {
  permissoes?: string[];
  perfilAtivo?: { nome?: string } | null;
  perfis?: string[];
} | null) {
  if (isAdministradorSistemaAtivo(user)) return true;
  return Boolean(user?.permissoes?.includes(buildMatrixKey('chamados', 'excluir_logicamente', 'excluir')));
}

export function canRestaurarChamadoExcluido(user?: {
  permissoes?: string[];
  perfilAtivo?: { nome?: string } | null;
  perfis?: string[];
} | null) {
  if (isAdministradorSistemaAtivo(user)) return true;
  return Boolean(user?.permissoes?.includes(buildMatrixKey('chamados', 'restaurar_excluido', 'alterar')));
}

export function hasChecklistAccess(permissoes: string[], action: PermissionAction = 'visualizar') {
  const matrix = permissoes.filter((key) => key.startsWith('matriz.checklists.'));
  if (matrix.length > 0) {
    return (
      matrix.includes(buildMatrixKey('checklists', '_tela', action)) ||
      matrix.includes(buildMatrixKey('checklists', 'gerenciar', action))
    );
  }
  return permissoes.includes('checklists.gerenciar');
}

export function isAdministradorSistemaAtivo(user?: {
  perfilAtivo?: { nome?: string } | null;
  perfis?: string[];
} | null) {
  const nome = user?.perfilAtivo?.nome ?? user?.perfis?.[0];
  return nome === ADMINISTRADOR_SISTEMA_NOME;
}

export function hasIntegracoesVisualizarAccess(
  permissoes: string[],
  user?: { perfilAtivo?: { nome?: string } | null; perfis?: string[] } | null,
) {
  if (isAdministradorSistemaAtivo(user)) return true;
  return (
    permissoes.includes('auditoria.visualizar') ||
    permissoes.includes(buildMatrixKey('integracoes', '_tela', 'visualizar')) ||
    permissoes.includes(buildMatrixKey('integracoes', 'monitorar', 'visualizar'))
  );
}

export function hasIntegracoesExecutarAccess(
  permissoes: string[],
  user?: { perfilAtivo?: { nome?: string } | null; perfis?: string[] } | null,
) {
  if (isAdministradorSistemaAtivo(user)) return true;
  return (
    permissoes.includes(buildMatrixKey('integracoes', '_tela', 'executar')) ||
    permissoes.includes(buildMatrixKey('integracoes', 'monitorar', 'executar'))
  );
}
