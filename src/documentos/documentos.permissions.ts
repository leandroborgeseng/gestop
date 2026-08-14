import { permissionMatrixKey } from '../domain/permissions-catalog';

/** Acesso ao módulo Documentos (cadastro/detalhes). */
export const DOCUMENTOS_MODULO_KEYS = [
  'documentos.visualizar',
  'documentos.administrar',
  permissionMatrixKey('documentos', '_tela', 'visualizar'),
  permissionMatrixKey('documentos', 'consultar', 'visualizar'),
] as const;

/** PDF e listagem relacionada a chamado/vistoria — não exige menu Documentos. */
export const DOCUMENTOS_RELACIONADOS_KEYS = [
  ...DOCUMENTOS_MODULO_KEYS,
  'documentos.gerar_pdf',
  'dashboard.visualizar',
  'chamados.gerenciar',
  'chamados.abrir',
  'meus_chamados.visualizar',
  'fiscalizacoes.executar',
  permissionMatrixKey('documentos', 'gerar_pdf', 'visualizar'),
  permissionMatrixKey('documentos', 'gerar_pdf', 'executar'),
  permissionMatrixKey('chamados', '_tela', 'visualizar'),
  permissionMatrixKey('chamados', 'abrir_chamado', 'visualizar'),
  permissionMatrixKey('meus_chamados', '_tela', 'visualizar'),
  permissionMatrixKey('meus_chamados', 'consultar', 'visualizar'),
  permissionMatrixKey('meus_chamados', 'consultar_documentos', 'visualizar'),
  permissionMatrixKey('vistoria_campo', '_tela', 'visualizar'),
  permissionMatrixKey('vistorias', '_tela', 'visualizar'),
  permissionMatrixKey('vistorias', 'consultar', 'visualizar'),
  permissionMatrixKey('execucao', '_tela', 'visualizar'),
] as const;

export function hasDocumentosModuloAccess(permissoes: string[]) {
  if (permissoes.includes('usuarios.gerenciar')) return true;
  return DOCUMENTOS_MODULO_KEYS.some((key) => permissoes.includes(key));
}

export function hasDocumentosRelacionadosAccess(permissoes: string[]) {
  if (hasDocumentosModuloAccess(permissoes)) return true;
  return DOCUMENTOS_RELACIONADOS_KEYS.some((key) => permissoes.includes(key));
}
