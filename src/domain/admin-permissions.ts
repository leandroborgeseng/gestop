import { permissionMatrixKey, type PermissionAction } from './permissions-catalog';

/** Abas da Administração com vínculo a Secretaria (escopo da sessão). */
export const ADMIN_SECRETARIA_SCOPED_TABS = [
  'secretarias',
  'proprios',
  'usuarios',
  'equipes',
] as const;

export type AdminTabId =
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
  | 'importacao';

const LEGACY_BY_TAB: Partial<Record<AdminTabId, string[]>> = {
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
};

/** Tabs que o legado `admin.cadastros` cobria. */
const CADASTROS_LEGACY_TABS: AdminTabId[] = ['secretarias', 'proprios', 'usuarios'];

/**
 * Chaves aceitas pelo PermissionsGuard para uma ação em uma aba da Administração.
 * Inclui matriz fina, cadastros legado e chaves legadas amplas (Administrador).
 */
export function adminTabPermissionKeys(tab: AdminTabId, action: PermissionAction): string[] {
  const keys = [permissionMatrixKey('admin', tab, action)];

  if (CADASTROS_LEGACY_TABS.includes(tab)) {
    keys.push(permissionMatrixKey('admin', 'cadastros', action));
  }

  // Superusuário legado: qualquer ação na Administração
  keys.push('usuarios.gerenciar');

  for (const legacy of LEGACY_BY_TAB[tab] ?? []) {
    if (!keys.includes(legacy)) keys.push(legacy);
  }

  return keys;
}

export function adminAnyTabVisualizarKeys(): string[] {
  const tabs: AdminTabId[] = [
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
  ];
  const keys = new Set<string>(['usuarios.gerenciar', permissionMatrixKey('admin', '_tela', 'visualizar')]);
  for (const tab of tabs) {
    for (const key of adminTabPermissionKeys(tab, 'visualizar')) {
      keys.add(key);
    }
  }
  return [...keys];
}
