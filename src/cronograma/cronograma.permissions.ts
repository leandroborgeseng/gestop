import { permissionMatrixKey } from '../domain/permissions-catalog';

/** Chaves aceitas para visualizar Cronograma (matriz + legado). */
export const CRONOGRAMA_VISUALIZAR_KEYS = [
  'cronograma.visualizar',
  'dashboard.visualizar',
  permissionMatrixKey('cronograma', '_tela', 'visualizar'),
  permissionMatrixKey('cronograma', 'gerenciar', 'visualizar'),
  permissionMatrixKey('cronograma', 'cobertura', 'visualizar'),
] as const;

export const CRONOGRAMA_INSERIR_KEYS = [
  'cronograma.inserir',
  'checklists.gerenciar',
  permissionMatrixKey('cronograma', '_tela', 'inserir'),
  permissionMatrixKey('cronograma', 'gerenciar', 'inserir'),
] as const;

export const CRONOGRAMA_ALTERAR_KEYS = [
  'cronograma.alterar',
  'checklists.gerenciar',
  permissionMatrixKey('cronograma', '_tela', 'alterar'),
  permissionMatrixKey('cronograma', 'gerenciar', 'alterar'),
] as const;

export const CRONOGRAMA_EXCLUIR_KEYS = [
  'cronograma.excluir',
  'checklists.gerenciar',
  permissionMatrixKey('cronograma', '_tela', 'excluir'),
  permissionMatrixKey('cronograma', 'gerenciar', 'excluir'),
] as const;

export const CRONOGRAMA_EXECUTAR_KEYS = [
  'cronograma.executar',
  permissionMatrixKey('cronograma', '_tela', 'executar'),
  permissionMatrixKey('cronograma', 'cobertura', 'executar'),
  permissionMatrixKey('cronograma', 'cobertura', 'visualizar'),
] as const;

/** Listagem de checklists para formulário de cronograma. */
export const CRONOGRAMA_CHECKLISTS_KEYS = [
  ...CRONOGRAMA_VISUALIZAR_KEYS,
  ...CRONOGRAMA_INSERIR_KEYS,
  ...CRONOGRAMA_ALTERAR_KEYS,
  'checklists.gerenciar',
] as const;
