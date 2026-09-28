import { BadRequestException } from '@nestjs/common';

/** Mesmo teto por arquivo já usado na abertura (8 MB). */
export const MAX_ANEXOS_ABERTURA = 8;
export const MAX_ANEXO_ABERTURA_BYTES = 8 * 1024 * 1024;
/** Soma cabe no corpo JSON da API sem estourar o limite da requisição. */
export const MAX_TOTAL_ANEXOS_ABERTURA_BYTES = 20 * 1024 * 1024;

export const ANEXOS_ABERTURA_FORMATOS = 'JPG, JPEG, PNG, WEBP e PDF';

const MIME_ABERTURA: Record<string, { extensao: string; categoria: 'imagem' | 'pdf' }> = {
  'image/jpeg': { extensao: 'jpg', categoria: 'imagem' },
  'image/png': { extensao: 'png', categoria: 'imagem' },
  'image/webp': { extensao: 'webp', categoria: 'imagem' },
  'application/pdf': { extensao: 'pdf', categoria: 'pdf' },
};

export type AnexoAberturaNormalizado = {
  dataUrl: string;
  mimeType: string;
  nome: string;
  extensao: string;
  categoria: 'imagem' | 'pdf';
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
  return informados.map((item, index) => {
    const dataUrl = item.dataUrl?.trim() ?? '';
    if (!dataUrl) {
      throw new BadRequestException('Um dos anexos está vazio. Envie o arquivo novamente.');
    }

    const lido = lerDataUrl(dataUrl, item.mimeType);
    const permitido = MIME_ABERTURA[lido.mimeType];
    if (!permitido) {
      throw new BadRequestException(`Formato não permitido. Use ${ANEXOS_ABERTURA_FORMATOS}.`);
    }
    if (lido.tamanhoBytes > MAX_ANEXO_ABERTURA_BYTES) {
      throw new BadRequestException('Cada arquivo pode ter no máximo 8 MB.');
    }
    total += lido.tamanhoBytes;
    if (total > MAX_TOTAL_ANEXOS_ABERTURA_BYTES) {
      throw new BadRequestException('O total dos anexos passa de 20 MB.');
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

  let mime = dataUrl.slice('data:'.length, indice).split(';')[0]?.trim().toLowerCase() || mimeInformado?.trim().toLowerCase() || '';
  if (mime === 'image/jpg') mime = 'image/jpeg';

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
  const categoria = registro.categoria === 'pdf' ? 'pdf' : 'imagem';
  return {
    nomeOriginal: typeof registro.nomeOriginal === 'string' ? registro.nomeOriginal : '',
    extensao: typeof registro.extensao === 'string' ? registro.extensao : '',
    categoria,
    anexadoPorId: typeof registro.anexadoPorId === 'string' ? registro.anexadoPorId : null,
    anexadoPorNome: typeof registro.anexadoPorNome === 'string' ? registro.anexadoPorNome : null,
  };
}

export function extensaoDeMime(mimeType: string) {
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/webp') return 'webp';
  if (mimeType === 'application/pdf') return 'pdf';
  return 'jpg';
}

function nomeSeguro(nome: string | undefined, extensao: string, index: number) {
  const bruto = (nome ?? '').split(/[/\\]/).pop()?.trim() || `anexo-${index + 1}.${extensao}`;
  const limpo = bruto.replace(/[^\w.\- ()\u00C0-\u024F]+/g, '_').slice(0, 160);
  const lower = limpo.toLowerCase();
  const extensoes = extensao === 'jpg' ? ['.jpg', '.jpeg'] : [`.${extensao}`];
  if (extensoes.some((item) => lower.endsWith(item))) return limpo || `anexo-${index + 1}.${extensao}`;
  return `${limpo || `anexo-${index + 1}`}.${extensao}`.slice(0, 180);
}
