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
const LEGACY_CHAMADOS_ABRIR = 'chamados.abrir';
const LEGACY_CHAMADOS_EXECUTAR = 'chamados.executar';
const LEGACY_CHAMADOS_EDITAR_ABERTURA = 'chamados.editar_abertura';
const LEGACY_CHAMADOS_EXECUCAO_MANUAL = 'chamados.execucao_manual';
const LEGACY_MEUS_CHAMADOS_VISUALIZAR = 'meus_chamados.visualizar';
const LEGACY_DOCUMENTOS_VISUALIZAR = 'documentos.visualizar';
const LEGACY_DOCUMENTOS_CRIAR_AVULSO = 'documentos.criar_avulso';
const LEGACY_DOCUMENTOS_EDITAR_VINCULO = 'documentos.editar_vinculo';
const LEGACY_DOCUMENTOS_GERAR_PDF = 'documentos.gerar_pdf';
const LEGACY_DOCUMENTOS_COLETAR_ASSINATURA = 'documentos.coletar_assinatura';
const LEGACY_DOCUMENTOS_CANCELAR_ASSINADO = 'documentos.cancelar_assinado';
const LEGACY_DOCUMENTOS_ADMINISTRAR = 'documentos.administrar';

const CHAMADOS_ABRIR_ONLY_KEYS = new Set([
  permissionMatrixKey('chamados', 'abrir_chamado', 'visualizar'),
  permissionMatrixKey('chamados', 'abrir_chamado', 'inserir'),
]);

function hasChamadosBeyondAbrir(matrixKeys: Set<string>) {
  return [...matrixKeys].some(
    (key) => key.startsWith('matriz.chamados.') && !CHAMADOS_ABRIR_ONLY_KEYS.has(key),
  );
}
const LEGACY_FISCALIZACOES_EXECUTAR = 'fiscalizacoes.executar';
const LEGACY_DASHBOARD_VISUALIZAR = 'dashboard.visualizar';
const LEGACY_USUARIOS_GERENCIAR = 'usuarios.gerenciar';
const LEGACY_SECRETARIAS_GERENCIAR = 'secretarias.gerenciar';
const LEGACY_SECRETARIAS_TODAS = 'secretarias.todas';
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

  // Gerenciar/triagem: permissões da tela Chamados além de “Novo chamado” (abrir_chamado).
  // Só abrir_chamado NÃO libera listagem/triagem/programação.
  if (hasChamadosBeyondAbrir(matrixKeys)) {
    legacy.add(LEGACY_CHAMADOS_GERENCIAR);
  }
  if (
    matrixKeys.has(permissionMatrixKey('chamados', 'abrir_chamado', 'visualizar')) ||
    matrixKeys.has(permissionMatrixKey('chamados', 'abrir_chamado', 'inserir'))
  ) {
    legacy.add(LEGACY_CHAMADOS_ABRIR);
  }
  // Meus chamados: tela própria OU quem abre/gerencia chamados (sem liberar triagem sozinha).
  if (
    hasPrefix('meus_chamados') ||
    legacy.has(LEGACY_CHAMADOS_ABRIR) ||
    legacy.has(LEGACY_CHAMADOS_GERENCIAR)
  ) {
    legacy.add(LEGACY_MEUS_CHAMADOS_VISUALIZAR);
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
  if (hasPrefix('documentos')) {
    legacy.add(LEGACY_DOCUMENTOS_VISUALIZAR);
    if (
      matrixKeys.has(permissionMatrixKey('documentos', 'avulso', 'inserir')) ||
      matrixKeys.has(permissionMatrixKey('documentos', '_tela', 'inserir'))
    ) {
      legacy.add(LEGACY_DOCUMENTOS_CRIAR_AVULSO);
    }
    if (
      matrixKeys.has(permissionMatrixKey('documentos', 'editar_vinculo', 'alterar')) ||
      matrixKeys.has(permissionMatrixKey('documentos', '_tela', 'alterar'))
    ) {
      legacy.add(LEGACY_DOCUMENTOS_EDITAR_VINCULO);
    }
    if (
      matrixKeys.has(permissionMatrixKey('documentos', 'gerar_pdf', 'executar')) ||
      matrixKeys.has(permissionMatrixKey('documentos', 'gerar_pdf', 'visualizar'))
    ) {
      legacy.add(LEGACY_DOCUMENTOS_GERAR_PDF);
    }
    if (matrixKeys.has(permissionMatrixKey('documentos', 'coletar_assinatura', 'executar'))) {
      legacy.add(LEGACY_DOCUMENTOS_COLETAR_ASSINATURA);
    }
    if (matrixKeys.has(permissionMatrixKey('documentos', 'cancelar_assinado', 'executar'))) {
      legacy.add(LEGACY_DOCUMENTOS_CANCELAR_ASSINADO);
    }
    if (
      matrixKeys.has(permissionMatrixKey('documentos', 'administrar', 'alterar')) ||
      matrixKeys.has(permissionMatrixKey('documentos', 'administrar', 'excluir')) ||
      matrixKeys.has(permissionMatrixKey('documentos', 'administrar', 'executar'))
    ) {
      legacy.add(LEGACY_DOCUMENTOS_ADMINISTRAR);
    }
  }
  if (hasPrefix('checklists')) {
    legacy.add(LEGACY_CHECKLISTS_GERENCIAR);
  }
  if (hasPrefix('admin')) {
    legacy.add(LEGACY_AUDITORIA_VISUALIZAR);
    const hasAdminFn = (fn: string, ...actions: string[]) =>
      actions.some((acao) => matrixKeys.has(permissionMatrixKey('admin', fn, acao as never)));

    // Superusuário legado só quando a tela Administração (_tela) ou cadastros legado
    // tiverem ações de escrita — visualizar por aba não concede usuarios.gerenciar.
    if (
      hasAdminFn('_tela', 'inserir', 'alterar', 'excluir', 'executar') ||
      hasAdminFn('cadastros', 'inserir', 'alterar', 'excluir')
    ) {
      legacy.add(LEGACY_USUARIOS_GERENCIAR);
    }
    if (hasAdminFn('secretarias', 'inserir', 'alterar', 'excluir') || hasAdminFn('cadastros', 'inserir', 'alterar', 'excluir')) {
      legacy.add(LEGACY_SECRETARIAS_GERENCIAR);
    }
    if (
      hasAdminFn('proprios', 'inserir', 'alterar', 'excluir') ||
      hasAdminFn('importacao', 'executar') ||
      hasAdminFn('cadastros', 'inserir', 'alterar', 'excluir')
    ) {
      legacy.add(LEGACY_UNIDADES_GERENCIAR);
    }
    if (hasAdminFn('permissoes', 'visualizar', 'inserir', 'alterar', 'excluir')) {
      legacy.add(LEGACY_PERMISSOES_GERENCIAR);
    }
    if (hasAdminFn('categorias_vistoria', 'inserir', 'alterar', 'excluir')) {
      legacy.add(LEGACY_CHECKLISTS_GERENCIAR);
    }
  }
  if (hasPrefix('permissoes')) {
    legacy.add(LEGACY_PERMISSOES_GERENCIAR);
    legacy.add(LEGACY_USUARIOS_GERENCIAR);
  }
  if (matrixKeys.has(permissionMatrixKey('permissoes', 'todas_secretarias', 'executar'))) {
    legacy.add(LEGACY_SECRETARIAS_TODAS);
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
    grantScreen('meus_chamados', ['visualizar']);
  }
  if (legacyKeys.has(LEGACY_CHAMADOS_ABRIR)) {
    matrix.add(permissionMatrixKey('chamados', 'abrir_chamado', 'visualizar'));
    matrix.add(permissionMatrixKey('chamados', 'abrir_chamado', 'inserir'));
    grantScreen('meus_chamados', ['visualizar']);
  }
  if (legacyKeys.has(LEGACY_MEUS_CHAMADOS_VISUALIZAR)) {
    grantScreen('meus_chamados', ['visualizar']);
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
    grantScreen('documentos', ['visualizar']);
  }
  if (legacyKeys.has(LEGACY_DOCUMENTOS_VISUALIZAR)) {
    grantScreen('documentos', ['visualizar']);
  }
  if (legacyKeys.has(LEGACY_DOCUMENTOS_CRIAR_AVULSO)) {
    matrix.add(permissionMatrixKey('documentos', 'avulso', 'inserir'));
    matrix.add(permissionMatrixKey('documentos', '_tela', 'inserir'));
  }
  if (legacyKeys.has(LEGACY_DOCUMENTOS_EDITAR_VINCULO)) {
    matrix.add(permissionMatrixKey('documentos', 'editar_vinculo', 'alterar'));
  }
  if (legacyKeys.has(LEGACY_DOCUMENTOS_GERAR_PDF)) {
    matrix.add(permissionMatrixKey('documentos', 'gerar_pdf', 'visualizar'));
    matrix.add(permissionMatrixKey('documentos', 'gerar_pdf', 'executar'));
  }
  if (legacyKeys.has(LEGACY_DOCUMENTOS_COLETAR_ASSINATURA)) {
    matrix.add(permissionMatrixKey('documentos', 'coletar_assinatura', 'executar'));
  }
  if (legacyKeys.has(LEGACY_DOCUMENTOS_CANCELAR_ASSINADO)) {
    matrix.add(permissionMatrixKey('documentos', 'cancelar_assinado', 'executar'));
  }
  if (legacyKeys.has(LEGACY_DOCUMENTOS_ADMINISTRAR)) {
    grantScreen('documentos');
  }
  if (legacyKeys.has(LEGACY_CHECKLISTS_GERENCIAR)) {
    grantScreen('checklists');
  }
  if (legacyKeys.has(LEGACY_USUARIOS_GERENCIAR)) {
    grantScreen('admin');
    grantScreen('permissoes', ['visualizar', 'alterar', 'inserir']);
  }
  if (legacyKeys.has(LEGACY_SECRETARIAS_GERENCIAR)) {
    for (const acao of ['visualizar', 'inserir', 'alterar', 'excluir'] as const) {
      matrix.add(permissionMatrixKey('admin', 'secretarias', acao));
      matrix.add(permissionMatrixKey('admin', 'cadastros', acao));
    }
  }
  if (legacyKeys.has(LEGACY_UNIDADES_GERENCIAR)) {
    for (const acao of ['visualizar', 'inserir', 'alterar', 'excluir'] as const) {
      matrix.add(permissionMatrixKey('admin', 'proprios', acao));
    }
    matrix.add(permissionMatrixKey('admin', 'importacao', 'visualizar'));
    matrix.add(permissionMatrixKey('admin', 'importacao', 'executar'));
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
  if (legacyKeys.has(LEGACY_SECRETARIAS_TODAS)) {
    matrix.add(permissionMatrixKey('permissoes', 'todas_secretarias', 'executar'));
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
  return keysForScreen(telaId, 'visualizar').some((key) => {
    if (!effectiveKeys.has(key)) return false;
    // “Novo chamado” sozinho não libera o menu Chamados (triagem/programação).
    if (telaId === 'chamados' && CHAMADOS_ABRIR_ONLY_KEYS.has(key)) return false;
    return true;
  });
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
