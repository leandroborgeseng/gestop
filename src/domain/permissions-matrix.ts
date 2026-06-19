import {
  PERMISSIONS_CATALOG,
  PermissionAction,
  PERMISSION_ACTIONS,
  listCatalogMatrixKeys,
  permissionMatrixKey,
  isMatrixPermissionKey,
} from './permissions-catalog';

/** Chaves legadas usadas pelos guards atuais — derivadas da matriz ao salvar. */
const LEGACY_CHAMADOS_GERENCIAR = 'chamados.gerenciar';
const LEGACY_CHAMADOS_EXECUTAR = 'chamados.executar';
const LEGACY_CHAMADOS_EDITAR_ABERTURA = 'chamados.editar_abertura';
const LEGACY_CHAMADOS_EXECUCAO_MANUAL = 'chamados.execucao_manual';
const LEGACY_FISCALIZACOES_EXECUTAR = 'fiscalizacoes.executar';
const LEGACY_DASHBOARD_VISUALIZAR = 'dashboard.visualizar';
const LEGACY_USUARIOS_GERENCIAR = 'usuarios.gerenciar';
const LEGACY_SECRETARIAS_GERENCIAR = 'secretarias.gerenciar';
const LEGACY_UNIDADES_GERENCIAR = 'unidades.gerenciar';
const LEGACY_CHECKLISTS_GERENCIAR = 'checklists.gerenciar';
const LEGACY_AUDITORIA_VISUALIZAR = 'auditoria.visualizar';
const LEGACY_SECRETARIA_GERENCIAR = 'secretaria.gerenciar';
const LEGACY_PERMISSOES_GERENCIAR = 'permissoes.gerenciar';

export function keysForScreen(telaId: string, acao: PermissionAction) {
  const tela = PERMISSIONS_CATALOG.find((item) => item.id === telaId);
  if (!tela) return [];
  const keys: string[] = [];
  for (const funcao of tela.functions) {
    if (funcao.actions.includes(acao)) {
      keys.push(permissionMatrixKey(telaId, funcao.id, acao));
    }
  }
  return keys;
}

export function keysForFunction(telaId: string, funcaoId: string, acao: PermissionAction) {
  return permissionMatrixKey(telaId, funcaoId, acao);
}

export function deriveLegacyPermissionKeys(matrixKeys: Set<string>): Set<string> {
  const legacy = new Set<string>();

  const hasPrefix = (prefix: string) => [...matrixKeys].some((key) => key.startsWith(`matriz.${prefix}.`));

  if (hasPrefix('chamados') || hasPrefix('execucao')) {
    legacy.add(LEGACY_CHAMADOS_GERENCIAR);
  }
  if (hasPrefix('execucao') || matrixKeys.has(permissionMatrixKey('chamados', 'execucao_manual', 'executar'))) {
    legacy.add(LEGACY_CHAMADOS_EXECUTAR);
  }
  if (matrixKeys.has(permissionMatrixKey('chamados', 'editar_abertura', 'alterar'))) {
    legacy.add(LEGACY_CHAMADOS_EDITAR_ABERTURA);
  }
  if (
    matrixKeys.has(permissionMatrixKey('chamados', 'execucao_manual', 'executar')) ||
    matrixKeys.has(permissionMatrixKey('execucao', 'lancamento_manual', 'executar'))
  ) {
    legacy.add(LEGACY_CHAMADOS_EXECUCAO_MANUAL);
  }
  if (hasPrefix('vistoria_campo')) {
    legacy.add(LEGACY_FISCALIZACOES_EXECUTAR);
  }
  if (hasPrefix('cco') || hasPrefix('dashboard') || hasPrefix('cronograma') || hasPrefix('relatorios') || hasPrefix('vistorias')) {
    legacy.add(LEGACY_DASHBOARD_VISUALIZAR);
  }
  if (hasPrefix('checklists')) {
    legacy.add(LEGACY_CHECKLISTS_GERENCIAR);
  }
  if (hasPrefix('admin')) {
    legacy.add(LEGACY_USUARIOS_GERENCIAR);
    legacy.add(LEGACY_SECRETARIAS_GERENCIAR);
    legacy.add(LEGACY_UNIDADES_GERENCIAR);
    legacy.add(LEGACY_AUDITORIA_VISUALIZAR);
  }
  if (hasPrefix('permissoes')) {
    legacy.add(LEGACY_PERMISSOES_GERENCIAR);
    legacy.add(LEGACY_USUARIOS_GERENCIAR);
  }
  if (hasPrefix('integracoes')) {
    legacy.add(LEGACY_DASHBOARD_VISUALIZAR);
  }

  return legacy;
}

/** Expande chaves legadas para pré-marcar a matriz ao carregar perfis antigos. */
export function expandLegacyToMatrixKeys(legacyKeys: Set<string>): Set<string> {
  const matrix = new Set<string>();

  const grantScreen = (telaId: string, actions: PermissionAction[] = [...PERMISSION_ACTIONS]) => {
    const tela = PERMISSIONS_CATALOG.find((item) => item.id === telaId);
    if (!tela) return;
    for (const funcao of tela.functions) {
      for (const acao of funcao.actions) {
        if (actions.includes(acao)) {
          matrix.add(permissionMatrixKey(telaId, funcao.id, acao));
        }
      }
    }
  };

  if (legacyKeys.has(LEGACY_CHAMADOS_GERENCIAR)) {
    grantScreen('chamados');
    grantScreen('execucao', ['visualizar', 'executar', 'inserir']);
  }
  if (legacyKeys.has(LEGACY_CHAMADOS_EXECUTAR)) {
    grantScreen('execucao', ['visualizar', 'executar', 'inserir']);
  }
  if (legacyKeys.has(LEGACY_CHAMADOS_EDITAR_ABERTURA)) {
    matrix.add(permissionMatrixKey('chamados', 'editar_abertura', 'alterar'));
  }
  if (legacyKeys.has(LEGACY_CHAMADOS_EXECUCAO_MANUAL)) {
    matrix.add(permissionMatrixKey('chamados', 'execucao_manual', 'executar'));
    matrix.add(permissionMatrixKey('execucao', 'lancamento_manual', 'executar'));
  }
  if (legacyKeys.has(LEGACY_FISCALIZACOES_EXECUTAR)) {
    grantScreen('vistoria_campo');
  }
  if (legacyKeys.has(LEGACY_DASHBOARD_VISUALIZAR)) {
    grantScreen('cco', ['visualizar']);
    grantScreen('dashboard', ['visualizar']);
    grantScreen('cronograma', ['visualizar', 'inserir', 'alterar']);
    grantScreen('relatorios', ['visualizar', 'executar']);
    grantScreen('vistorias', ['visualizar']);
    grantScreen('integracoes', ['visualizar']);
  }
  if (legacyKeys.has(LEGACY_CHECKLISTS_GERENCIAR)) {
    grantScreen('checklists');
  }
  if (legacyKeys.has(LEGACY_USUARIOS_GERENCIAR)) {
    grantScreen('admin');
    grantScreen('permissoes', ['visualizar', 'alterar', 'inserir']);
  }
  if (legacyKeys.has(LEGACY_SECRETARIAS_GERENCIAR)) {
    matrix.add(permissionMatrixKey('admin', 'cadastros', 'visualizar'));
    matrix.add(permissionMatrixKey('admin', 'cadastros', 'inserir'));
    matrix.add(permissionMatrixKey('admin', 'cadastros', 'alterar'));
  }
  if (legacyKeys.has(LEGACY_UNIDADES_GERENCIAR)) {
    matrix.add(permissionMatrixKey('admin', 'cadastros', 'visualizar'));
    matrix.add(permissionMatrixKey('admin', 'cadastros', 'alterar'));
  }
  if (legacyKeys.has(LEGACY_SECRETARIA_GERENCIAR)) {
    grantScreen('chamados', ['visualizar', 'alterar', 'executar', 'inserir']);
    grantScreen('cco', ['visualizar']);
    grantScreen('vistorias', ['visualizar']);
  }
  if (legacyKeys.has(LEGACY_PERMISSOES_GERENCIAR)) {
    grantScreen('permissoes', ['visualizar', 'alterar', 'inserir']);
  }

  return matrix;
}

export function resolveEffectiveMatrixKeys(storedKeys: string[]): Set<string> {
  const legacy = new Set(storedKeys.filter((key) => !isMatrixPermissionKey(key)));
  const matrix = new Set(storedKeys.filter((key) => isMatrixPermissionKey(key)));

  if (matrix.size === 0 && legacy.size > 0) {
    for (const key of expandLegacyToMatrixKeys(legacy)) {
      matrix.add(key);
    }
  }

  return matrix;
}

export function buildMatrixSavePayload(selectedKeys: string[]) {
  const matrix = new Set(selectedKeys.filter(isMatrixPermissionKey));
  const catalogKeys = new Set(listCatalogMatrixKeys());
  for (const key of [...matrix]) {
    if (!catalogKeys.has(key)) {
      matrix.delete(key);
    }
  }
  const legacy = deriveLegacyPermissionKeys(matrix);
  return {
    matrixKeys: [...matrix].sort(),
    legacyKeys: [...legacy].sort(),
    allKeys: [...new Set([...matrix, ...legacy])].sort(),
  };
}

export type MatrixPermissionChange = {
  telaId: string;
  telaLabel: string;
  funcaoId: string;
  funcaoLabel: string;
  acao: PermissionAction;
  anterior: boolean;
  novo: boolean;
};

export function diffMatrixPermissions(before: Set<string>, after: Set<string>): MatrixPermissionChange[] {
  const changes: MatrixPermissionChange[] = [];
  for (const tela of PERMISSIONS_CATALOG) {
    for (const funcao of tela.functions) {
      for (const acao of PERMISSION_ACTIONS) {
        if (!funcao.actions.includes(acao)) continue;
        const key = permissionMatrixKey(tela.id, funcao.id, acao);
        const was = before.has(key);
        const now = after.has(key);
        if (was === now) continue;
        changes.push({
          telaId: tela.id,
          telaLabel: tela.label,
          funcaoId: funcao.id,
          funcaoLabel: funcao.label,
          acao,
          anterior: was,
          novo: now,
        });
      }
    }
  }
  return changes;
}

/** Tela visível no menu se tiver visualizar na linha da tela ou em alguma função. */
export function screenHasVisualizarAccess(telaId: string, effectiveKeys: Set<string>) {
  return keysForScreen(telaId, 'visualizar').some((key) => effectiveKeys.has(key));
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
