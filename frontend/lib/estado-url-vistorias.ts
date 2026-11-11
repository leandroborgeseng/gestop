import { dataIsoValida, definirParam, enumUrl, idUrl } from '@/lib/estado-url';
import type { FiscalizacaoStatus, UnidadeTipo } from '@/lib/types';
import { lerIdVistoriaDaUrl } from '@/lib/vistoria-deep-link';

const STATUS: FiscalizacaoStatus[] = ['CONCLUIDA', 'EM_ANDAMENTO', 'PLANEJADA', 'SINCRONIZACAO_PENDENTE', 'CANCELADA'];
const TIPOS: UnidadeTipo[] = ['ESCOLA', 'UBS', 'PRACA', 'PREDIO_ADMINISTRATIVO', 'ESPACO_ESPORTIVO', 'OUTRO'];

export type EstadoVistorias = {
  search: string;
  id: string | null;
  status: '' | FiscalizacaoStatus;
  tipo: '' | UnidadeTipo;
  secretaria: string;
  agente: string;
  de: string;
  ate: string;
  avulsa: '' | 'true' | 'false';
};

export function lerEstadoVistorias(sp: URLSearchParams): { estado: EstadoVistorias; canonico: URLSearchParams } {
  const statusRaw = sp.get('status');
  const status = !statusRaw
    ? 'CONCLUIDA'
    : statusRaw.trim().toLowerCase() === 'todas'
      ? ''
      : (enumUrl(statusRaw, STATUS) ?? 'CONCLUIDA');
  const avulsaRaw = sp.get('avulsa')?.trim().toLowerCase();
  const estado: EstadoVistorias = {
    search: sp.get('search')?.trim() ?? '',
    id: lerIdVistoriaDaUrl(`?id=${encodeURIComponent(sp.get('id') ?? '')}`),
    status,
    tipo: enumUrl(sp.get('tipoUnidade'), TIPOS) ?? '',
    secretaria: idUrl(sp.get('secretaria')) ?? '',
    agente: idUrl(sp.get('agente')) ?? '',
    de: dataIsoValida(sp.get('de')) ?? '',
    ate: dataIsoValida(sp.get('ate')) ?? '',
    avulsa: avulsaRaw === 'sim' ? 'true' : avulsaRaw === 'nao' ? 'false' : '',
  };
  return { estado, canonico: serializarEstadoVistorias(estado) };
}

export function serializarEstadoVistorias(estado: EstadoVistorias) {
  const params = new URLSearchParams();
  definirParam(params, 'search', estado.search.trim());
  definirParam(params, 'id', estado.id);
  if (estado.status === '') params.set('status', 'todas');
  else if (estado.status !== 'CONCLUIDA') params.set('status', estado.status.toLowerCase());
  if (estado.tipo) params.set('tipoUnidade', estado.tipo.toLowerCase());
  definirParam(params, 'secretaria', estado.secretaria);
  definirParam(params, 'agente', estado.agente);
  if (estado.de) params.set('de', estado.de);
  if (estado.ate) params.set('ate', estado.ate);
  if (estado.avulsa === 'true') params.set('avulsa', 'sim');
  if (estado.avulsa === 'false') params.set('avulsa', 'nao');
  return params;
}
