import { permissionMatrixKey } from '../domain/permissions-catalog';

/** Quem pode abrir chamado (matriz + legado), incluindo origem pela vistoria. */
export const CHAMADOS_ABRIR_KEYS = [
  'chamados.abrir',
  'chamados.gerenciar',
  permissionMatrixKey('chamados', 'abrir_chamado', 'visualizar'),
  permissionMatrixKey('chamados', 'abrir_chamado', 'inserir'),
  permissionMatrixKey('chamados', '_tela', 'inserir'),
  permissionMatrixKey('chamados', '_tela', 'visualizar'),
  'fiscalizacoes.executar',
  permissionMatrixKey('vistoria_campo', 'iniciar_vistoria', 'executar'),
] as const;
