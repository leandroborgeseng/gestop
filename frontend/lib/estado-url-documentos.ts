import type { DocumentoSituacao, DocumentoTipo } from '@/lib/types';
import { definirParam, enumUrl, flagUrl, idUrl } from '@/lib/estado-url';

const TIPOS: DocumentoTipo[] = [
  'RELATORIO_VISTORIA',
  'CHECKLIST_PREENCHIDO',
  'RELATORIO_EXECUCAO',
  'RELATORIO_FOTOGRAFICO',
  'NOTIFICACAO',
  'AUTO',
  'TERMO',
  'TERMO_CIENCIA',
  'DOCUMENTO_AVULSO',
  'OUTRO',
];

const SITUACOES: DocumentoSituacao[] = [
  'RASCUNHO',
  'GERADO',
  'SEM_ASSINATURA_EXTERNA',
  'ASSINATURA_PENDENTE',
  'ASSINADO_VIGENTE',
  'CANCELADO',
  'SUBSTITUIDO',
  'INVALIDO',
];

const ASSINATURAS = ['pendente', 'assinado', 'cancelado', 'substituido', 'minha'] as const;

export type EstadoDocumentos = {
  search: string;
  id: string | null;
  preencher: boolean;
  tipo: 'TODOS' | DocumentoTipo;
  situacao: 'TODOS' | DocumentoSituacao;
  assinatura: 'TODOS' | (typeof ASSINATURAS)[number];
  historico: boolean;
  pendentes: boolean;
};

export function lerEstadoDocumentos(sp: URLSearchParams): { estado: EstadoDocumentos; canonico: URLSearchParams } {
  const tipo = enumUrl(sp.get('tipo'), TIPOS);
  const situacao = enumUrl(sp.get('situacao'), SITUACOES);
  const assinatura = enumUrl(sp.get('assinatura'), ASSINATURAS);
  const id = idUrl(sp.get('id'));
  const estado: EstadoDocumentos = {
    search: sp.get('search')?.trim() ?? '',
    id,
    preencher: Boolean(id) && flagUrl(sp.get('preencher')),
    tipo: tipo ?? 'TODOS',
    situacao: situacao ?? 'TODOS',
    assinatura: assinatura ?? 'TODOS',
    historico: flagUrl(sp.get('historico')),
    pendentes: flagUrl(sp.get('pendentes')),
  };
  return { estado, canonico: serializarEstadoDocumentos(estado) };
}

export function serializarEstadoDocumentos(estado: EstadoDocumentos) {
  const params = new URLSearchParams();
  definirParam(params, 'search', estado.search.trim());
  definirParam(params, 'id', estado.id);
  if (estado.id && estado.preencher) params.set('preencher', '1');
  if (estado.tipo !== 'TODOS') params.set('tipo', estado.tipo.toLowerCase());
  if (estado.situacao !== 'TODOS') params.set('situacao', estado.situacao.toLowerCase());
  if (estado.assinatura !== 'TODOS') params.set('assinatura', estado.assinatura);
  if (estado.historico) params.set('historico', '1');
  if (estado.pendentes) params.set('pendentes', '1');
  return params;
}
