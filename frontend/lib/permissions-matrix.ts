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
  execucao: 'execucao',
  dashboard: 'dashboard',
  cronograma: 'cronograma',
  relatorios: 'relatorios',
  admin: 'admin',
  checklists: 'checklists',
  integracoes: 'integracoes',
};

export function screenHasVisualizarAccess(telaId: string, permissoes: string[]) {
  const set = new Set(permissoes);
  return permissoes.some(
    (key) => key.startsWith(`matriz.${telaId}.`) && key.endsWith('.visualizar') && set.has(key),
  );
}

export function navItemAllowedByMatrix(itemId: string, permissoes: string[]) {
  const telaId = NAV_SCREEN_MAP[itemId];
  if (!telaId) return null;
  const hasMatrix = permissoes.some(isMatrixPermissionKey);
  if (!hasMatrix) return null;
  return screenHasVisualizarAccess(telaId, permissoes);
}
