import { permissionMatrixKey } from '../domain/permissions-catalog';
import { CRONOGRAMA_VISUALIZAR_KEYS } from '../cronograma/cronograma.permissions';

/** Leitura operacional (secretarias/unidades) usada por CCO, Cronograma, abertura de chamado e vistoria. */
export const OPERACIONAL_READ_KEYS = [
  'dashboard.visualizar',
  'chamados.gerenciar',
  'chamados.abrir',
  'chamados.executar',
  'fiscalizacoes.executar',
  'meus_chamados.visualizar',
  'documentos.visualizar',
  'cronograma.visualizar',
  'cronograma.inserir',
  'cronograma.alterar',
  permissionMatrixKey('cco', '_tela', 'visualizar'),
  permissionMatrixKey('cco', 'mapa', 'visualizar'),
  permissionMatrixKey('cco', 'consultar_proprios', 'visualizar'),
  permissionMatrixKey('dashboard', '_tela', 'visualizar'),
  permissionMatrixKey('vistoria_campo', '_tela', 'visualizar'),
  permissionMatrixKey('vistoria_campo', 'iniciar_vistoria', 'executar'),
  permissionMatrixKey('chamados', '_tela', 'visualizar'),
  permissionMatrixKey('chamados', 'abrir_chamado', 'visualizar'),
  permissionMatrixKey('chamados', 'abrir_chamado', 'inserir'),
  permissionMatrixKey('execucao', '_tela', 'visualizar'),
  permissionMatrixKey('meus_chamados', '_tela', 'visualizar'),
  permissionMatrixKey('documentos', '_tela', 'visualizar'),
  permissionMatrixKey('documentos', 'consultar', 'visualizar'),
  ...CRONOGRAMA_VISUALIZAR_KEYS,
] as const;
