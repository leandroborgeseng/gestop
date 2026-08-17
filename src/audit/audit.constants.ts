import { AuditAction } from '@prisma/client';
import { PERMISSIONS_CATALOG } from '../domain/permissions-catalog';

export const AUDITORIA_EVENTOS = [
  { id: 'VIEW', label: 'Visualizar' },
  { id: 'CREATE', label: 'Inserir' },
  { id: 'UPDATE', label: 'Alterar' },
  { id: 'DELETE', label: 'Excluir' },
  { id: 'STATUS_CHANGE', label: 'Executar' },
  { id: 'LOGIN', label: 'Login' },
  { id: 'LOGOUT', label: 'Logoff' },
  { id: 'ERROR', label: 'Erro' },
  { id: 'SYNC', label: 'Sincronização' },
  { id: 'SIGNATURE', label: 'Assinatura' },
  { id: 'PDF', label: 'PDF' },
  { id: 'CANCEL', label: 'Cancelamento' },
  { id: 'PERMISSION_CHANGE', label: 'Permissões' },
] as const;

export type AuditoriaEventoId = (typeof AUDITORIA_EVENTOS)[number]['id'];

/** Eventos que o SIGMA já grava hoje — nascem ativos na configuração. */
export const AUDITORIA_EVENTOS_JA_REGISTRADOS: AuditoriaEventoId[] = [
  'CREATE',
  'UPDATE',
  'DELETE',
  'STATUS_CHANGE',
  'SYNC',
  'PERMISSION_CHANGE',
  'LOGIN',
  'LOGOUT',
];

export function auditoriaConfigChave(telaId: string, funcaoId: string, acao: string) {
  return `${telaId}::${funcaoId}::${acao}`;
}

export function mapAuditActionToEvento(acao: AuditAction | string): AuditoriaEventoId {
  const value = String(acao);
  if (AUDITORIA_EVENTOS.some((item) => item.id === value)) {
    return value as AuditoriaEventoId;
  }
  return 'UPDATE';
}

export function entidadeTipoParaTela(entidadeTipo: string): { telaId: string; funcaoId: string } {
  switch (entidadeTipo) {
    case 'Secretaria':
      return { telaId: 'admin', funcaoId: 'secretarias' };
    case 'UnidadePublica':
      return { telaId: 'admin', funcaoId: 'proprios' };
    case 'Usuario':
      return { telaId: 'admin', funcaoId: 'usuarios' };
    case 'Equipe':
      return { telaId: 'admin', funcaoId: 'equipes' };
    case 'Cargo':
      return { telaId: 'admin', funcaoId: 'cargos' };
    case 'TipoChamado':
      return { telaId: 'admin', funcaoId: 'tipos_chamado' };
    case 'TipoProprio':
      return { telaId: 'admin', funcaoId: 'tipos_proprio' };
    case 'CategoriaVistoria':
      return { telaId: 'admin', funcaoId: 'categorias_vistoria' };
    case 'Perfil':
    case 'Permissao':
      return { telaId: 'admin', funcaoId: 'permissoes' };
    case 'AuditoriaConfig':
      return { telaId: 'admin', funcaoId: 'auditoria' };
    case 'BackupS3Config':
    case 'BackupS3Run':
    case 'BackupS3Restore':
      return { telaId: 'admin', funcaoId: 'backup' };
    case 'Chamado':
      return { telaId: 'chamados', funcaoId: '_tela' };
    case 'Documento':
      return { telaId: 'documentos', funcaoId: '_tela' };
    case 'Checklist':
    case 'ChecklistVersao':
      return { telaId: 'checklists', funcaoId: '_tela' };
    case 'Fiscalizacao':
      return { telaId: 'vistorias', funcaoId: '_tela' };
    case 'Cronograma':
    case 'CronogramaChecagem':
      return { telaId: 'cronograma', funcaoId: '_tela' };
    case 'Integracao':
    case 'Notificacao':
    case 'OfflineSyncEvent':
      return { telaId: 'integracoes', funcaoId: 'monitorar' };
    case 'Auth':
    case 'Sessao':
      return { telaId: 'auth', funcaoId: '_tela' };
    default:
      return { telaId: 'admin', funcaoId: '_tela' };
  }
}

export function catalogoTelasAuditoria() {
  return [
    { id: 'auth', label: 'Autenticação', functions: [{ id: '_tela', label: 'Login e sessão' }] },
    ...PERMISSIONS_CATALOG.map((tela) => ({
      id: tela.id,
      label: tela.label,
      functions: tela.functions.map((funcao) => ({ id: funcao.id, label: funcao.label })),
    })),
  ];
}
