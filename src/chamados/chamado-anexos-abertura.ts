import { BadRequestException } from '@nestjs/common';
import {
  CategoriaAnexo,
  FORMATOS_ANEXO_TEXTO,
  MAX_TOTAL_ANEXOS_COM_VIDEO_BYTES,
  MAX_TOTAL_ANEXOS_SEM_VIDEO_BYTES,
  infoMimeAnexo,
  mensagemTamanhoAnexo,
  normalizarMimeAnexo,
} from './anexos-midia';

/** Mesmo teto por arquivo já usado na abertura (8 MB) para imagem e PDF. */
export const MAX_ANEXOS_ABERTURA = 8;
export const MAX_ANEXO_ABERTURA_BYTES = 8 * 1024 * 1024;
/** Soma cabe no corpo JSON da API sem estourar o limite da requisição. */
export const MAX_TOTAL_ANEXOS_ABERTURA_BYTES = MAX_TOTAL_ANEXOS_SEM_VIDEO_BYTES;

export const ANEXOS_ABERTURA_FORMATOS = FORMATOS_ANEXO_TEXTO;

export type AnexoAberturaNormalizado = {
  dataUrl: string;
  mimeType: string;
  nome: string;
  extensao: string;
  categoria: CategoriaAnexo;
  tamanhoBytes: number;
};

export function normalizarAnexosAbertura(input: {
  anexos?: Array<{ dataUrl?: string; mimeType?: string; nome?: string }>;
  fotoDataUrl?: string;
}): AnexoAberturaNormalizado[] {
  const informados = input.anexos?.length
    ? input.anexos
    : input.fotoDataUrl?.trim()
      ? [{ dataUrl: input.fotoDataUrl.trim(), nome: 'foto-abertura.jpg' }]
      : [];

  if (informados.length > MAX_ANEXOS_ABERTURA) {
    throw new BadRequestException(`É possível anexar no máximo ${MAX_ANEXOS_ABERTURA} arquivos na abertura.`);
  }

  let total = 0;
  let temVideo = false;
  return informados.map((item, index) => {
    const dataUrl = item.dataUrl?.trim() ?? '';
    if (!dataUrl) {
      throw new BadRequestException('Um dos anexos está vazio. Envie o arquivo novamente.');
    }

    const lido = lerDataUrl(dataUrl, item.mimeType);
    const permitido = infoMimeAnexo(lido.mimeType);
    if (!permitido) {
      throw new BadRequestException(`Formato não permitido. Formatos permitidos: ${ANEXOS_ABERTURA_FORMATOS}.`);
    }
    if (lido.tamanhoBytes > (permitido.categoria === 'video' ? 25 * 1024 * 1024 : MAX_ANEXO_ABERTURA_BYTES)) {
      throw new BadRequestException(mensagemTamanhoAnexo(permitido.categoria));
    }
    if (permitido.categoria === 'video') temVideo = true;
    total += lido.tamanhoBytes;
    const teto = temVideo ? MAX_TOTAL_ANEXOS_COM_VIDEO_BYTES : MAX_TOTAL_ANEXOS_ABERTURA_BYTES;
    if (total > teto) {
      throw new BadRequestException(temVideo ? 'O total dos anexos passa de 30 MB.' : 'O total dos anexos passa de 20 MB.');
    }

    return {
      dataUrl,
      mimeType: lido.mimeType,
      nome: nomeSeguro(item.nome, permitido.extensao, index),
      extensao: permitido.extensao,
      categoria: permitido.categoria,
      tamanhoBytes: lido.tamanhoBytes,
    };
  });
}

function lerDataUrl(dataUrl: string, mimeInformado?: string) {
  const marker = ';base64,';
  const indice = dataUrl.indexOf(marker);
  if (!dataUrl.startsWith('data:') || indice < 0) {
    throw new BadRequestException('Anexo inválido. Envie o arquivo novamente.');
  }

  const bruto = dataUrl.slice('data:'.length, indice).split(';')[0]?.trim() || mimeInformado?.trim() || '';
  const mime = normalizarMimeAnexo(bruto);

  const base64 = dataUrl.slice(indice + marker.length).replace(/\s/g, '');
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  const tamanhoBytes = Math.max(0, Math.floor((base64.length * 3) / 4) - padding);
  return { mimeType: mime, tamanhoBytes };
}

export function origemEvidencia(metadata: unknown) {
  if (!metadata || typeof metadata !== 'object') return '';
  const origem = (metadata as { origem?: unknown }).origem;
  return typeof origem === 'string' ? origem : '';
}

export function metadataAbertura(metadata: unknown) {
  const registro = metadata && typeof metadata === 'object' ? (metadata as Record<string, unknown>) : {};
  const categoria = registro.categoria === 'pdf' ? 'pdf' : registro.categoria === 'video' ? 'video' : 'imagem';
  return {
    nomeOriginal: typeof registro.nomeOriginal === 'string' ? registro.nomeOriginal : '',
    extensao: typeof registro.extensao === 'string' ? registro.extensao : '',
    categoria,
    anexadoPorId: typeof registro.anexadoPorId === 'string' ? registro.anexadoPorId : null,
    anexadoPorNome: typeof registro.anexadoPorNome === 'string' ? registro.anexadoPorNome : null,
  };
}

export function extensaoDeMime(mimeType: string) {
  return infoMimeAnexo(mimeType)?.extensao ?? 'jpg';
}

function nomeSeguro(nome: string | undefined, extensao: string, index: number) {
  const bruto = (nome ?? '').split(/[/\\]/).pop()?.trim() || `anexo-${index + 1}.${extensao}`;
  const limpo = bruto.replace(/[^\w.\- ()\u00C0-\u024F]+/g, '_').slice(0, 160);
  const lower = limpo.toLowerCase();
  const extensoes = extensao === 'jpg' ? ['.jpg', '.jpeg'] : [`.${extensao}`];
  if (extensoes.some((item) => lower.endsWith(item))) return limpo || `anexo-${index + 1}.${extensao}`;
  return `${limpo || `anexo-${index + 1}`}.${extensao}`.slice(0, 180);
}
