import { extractStorageKeyFromUrl, resolveStoragePublicUrl } from '../storage/storage-url';
import { extensaoDeMime, metadataAbertura, origemEvidencia } from './chamado-anexos-abertura';

export const ACOES_GESTAO_CHAMADO_VIA_TAREFA = [
  'historico',
  'status',
  'anexo',
  'excluir-anexo',
  'encerrar',
] as const;

export type AcaoGestaoChamadoViaTarefa = (typeof ACOES_GESTAO_CHAMADO_VIA_TAREFA)[number];

type EvidenciaLeitura = {
  id: string;
  url: string;
  storageKey?: string | null;
  mimeType?: string | null;
  tamanhoBytes?: number | null;
  capturadaEm: Date | string;
  metadata?: unknown;
};

type ChamadoFotoLeitura = {
  id?: string;
  fotoUrl?: string | null;
  fotoMimeType?: string | null;
  createdAt?: Date | string;
  registradoPorId?: string | null;
  registradoPor?: { nome: string } | null;
};

export function montarAnexosAberturaLeitura(chamado: ChamadoFotoLeitura, evidencias: EvidenciaLeitura[]) {
  const daAbertura = evidencias.filter((item) => origemEvidencia(item.metadata) === 'abertura');
  if (daAbertura.length) {
    return daAbertura.map((item) => serializarAnexoAbertura(item));
  }
  if (!chamado.fotoUrl) return [];
  const mimeType = chamado.fotoMimeType || 'image/jpeg';
  const enviadoEm =
    chamado.createdAt instanceof Date
      ? chamado.createdAt.toISOString()
      : chamado.createdAt ?? new Date(0).toISOString();
  return [
    {
      id: `legado-${chamado.id ?? 'foto'}`,
      nome: 'Foto da abertura',
      mimeType,
      extensao: extensaoDeMime(mimeType),
      categoria: 'imagem' as const,
      url: chamado.fotoUrl,
      tamanhoBytes: null as number | null,
      enviadoEm,
      anexadoPorId: chamado.registradoPorId ?? null,
      anexadoPorNome: chamado.registradoPor?.nome ?? null,
    },
  ];
}

export function serializarAnexoHistoricoLeitura(item: EvidenciaLeitura) {
  const storageKey = item.storageKey ?? extractStorageKeyFromUrl(item.url);
  const meta =
    item.metadata && typeof item.metadata === 'object' && item.metadata !== null
      ? (item.metadata as { descricao?: string; nome?: string; nomeOriginal?: string })
      : null;
  const nomeArquivo = meta?.nome?.trim() || meta?.nomeOriginal?.trim() || null;
  return {
    id: item.id,
    url: resolveStoragePublicUrl(storageKey, item.url) ?? item.url,
    mimeType: item.mimeType ?? null,
    descricao: meta?.descricao?.trim() || nomeArquivo,
    nome: nomeArquivo,
  };
}

function serializarAnexoAbertura(item: EvidenciaLeitura) {
  const meta = metadataAbertura(item.metadata);
  const storageKey = item.storageKey ?? extractStorageKeyFromUrl(item.url);
  const mimeType = item.mimeType || (meta.categoria === 'pdf' ? 'application/pdf' : 'image/jpeg');
  const categoria =
    meta.categoria === 'pdf' || mimeType === 'application/pdf'
      ? ('pdf' as const)
      : meta.categoria === 'video' || mimeType.startsWith('video/')
        ? ('video' as const)
        : ('imagem' as const);
  const capturadaEm =
    item.capturadaEm instanceof Date ? item.capturadaEm.toISOString() : item.capturadaEm;
  return {
    id: item.id,
    nome: meta.nomeOriginal || 'Anexo da abertura',
    mimeType,
    extensao: meta.extensao || extensaoDeMime(mimeType),
    categoria,
    url: resolveStoragePublicUrl(storageKey, item.url) ?? item.url,
    tamanhoBytes: item.tamanhoBytes ?? null,
    enviadoEm: capturadaEm,
    anexadoPorId: meta.anexadoPorId,
    anexadoPorNome: meta.anexadoPorNome,
  };
}
