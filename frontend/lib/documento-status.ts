import type { DocumentoSituacao, DocumentoTipo } from './types';

export const DOCUMENTO_TIPO_LABELS: Record<DocumentoTipo, string> = {
  RELATORIO_VISTORIA: 'Relatório de vistoria',
  CHECKLIST_PREENCHIDO: 'Checklist preenchido',
  RELATORIO_EXECUCAO: 'Relatório de execução',
  RELATORIO_FOTOGRAFICO: 'Relatório fotográfico',
  NOTIFICACAO: 'Notificação',
  AUTO: 'Auto',
  TERMO: 'Termo',
  TERMO_CIENCIA: 'Termo de ciência',
  DOCUMENTO_AVULSO: 'Documento avulso',
  OUTRO: 'Outro',
};

export const DOCUMENTO_SITUACAO_META: Record<
  DocumentoSituacao,
  { label: string; badge: 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'brand' }
> = {
  RASCUNHO: { label: 'Rascunho', badge: 'neutral' },
  GERADO: { label: 'Gerado', badge: 'info' },
  SEM_ASSINATURA_EXTERNA: { label: 'Sem assinatura externa', badge: 'info' },
  ASSINATURA_PENDENTE: { label: 'Assinatura pendente', badge: 'warning' },
  ASSINADO_VIGENTE: { label: 'Assinado vigente', badge: 'success' },
  CANCELADO: { label: 'Cancelado', badge: 'danger' },
  SUBSTITUIDO: { label: 'Substituído', badge: 'neutral' },
  INVALIDO: { label: 'Inválido', badge: 'danger' },
};
