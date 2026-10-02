import { BadRequestException } from '@nestjs/common';

/** Lista única de abertura, histórico do chamado e anexos de tarefa. */
export const FORMATOS_ANEXO_TEXTO = 'JPG, JPEG, PNG, WEBP, PDF, MP4, MOV, M4V, 3GP e WEBM';

export const MAX_ANEXO_IMAGEM_PDF_BYTES = 8 * 1024 * 1024;
/** Cabe no corpo JSON de 40 MB da API (o base64 aumenta o tamanho). */
export const MAX_ANEXO_VIDEO_BYTES = 25 * 1024 * 1024;
export const MAX_TOTAL_ANEXOS_SEM_VIDEO_BYTES = 20 * 1024 * 1024;
export const MAX_TOTAL_ANEXOS_COM_VIDEO_BYTES = 30 * 1024 * 1024;

export type CategoriaAnexo = 'imagem' | 'pdf' | 'video';

const MIME_ANEXO: Record<string, { extensao: string; categoria: CategoriaAnexo }> = {
  'image/jpeg': { extensao: 'jpg', categoria: 'imagem' },
  'image/png': { extensao: 'png', categoria: 'imagem' },
  'image/webp': { extensao: 'webp', categoria: 'imagem' },
  'application/pdf': { extensao: 'pdf', categoria: 'pdf' },
  'video/mp4': { extensao: 'mp4', categoria: 'video' },
  'video/quicktime': { extensao: 'mov', categoria: 'video' },
  'video/webm': { extensao: 'webm', categoria: 'video' },
  'video/3gpp': { extensao: '3gp', categoria: 'video' },
  'video/3gpp2': { extensao: '3gp', categoria: 'video' },
  'video/x-m4v': { extensao: 'm4v', categoria: 'video' },
};

export function normalizarMimeAnexo(mime: string) {
  const lower = mime.trim().toLowerCase();
  if (lower === 'image/jpg' || lower === 'image/pjpeg') return 'image/jpeg';
  if (lower === 'video/m4v') return 'video/x-m4v';
  if (lower === 'video/mov') return 'video/quicktime';
  return lower;
}

export function infoMimeAnexo(mime: string) {
  return MIME_ANEXO[normalizarMimeAnexo(mime)] ?? null;
}

export function mimesAnexoPermitidos() {
  return new Set(Object.keys(MIME_ANEXO));
}

export function limiteBytesAnexo(categoria: CategoriaAnexo) {
  return categoria === 'video' ? MAX_ANEXO_VIDEO_BYTES : MAX_ANEXO_IMAGEM_PDF_BYTES;
}

export function mensagemTamanhoAnexo(categoria: CategoriaAnexo) {
  return categoria === 'video' ? 'Cada vídeo pode ter no máximo 25 MB.' : 'Cada arquivo pode ter no máximo 8 MB.';
}

export function validarBufferAnexo(mime: string, tamanho: number) {
  const info = infoMimeAnexo(mime);
  if (!info) {
    throw new BadRequestException(`Formato não permitido. Formatos permitidos: ${FORMATOS_ANEXO_TEXTO}.`);
  }
  if (tamanho <= 0) throw new BadRequestException('Anexo vazio.');
  if (tamanho > limiteBytesAnexo(info.categoria)) {
    throw new BadRequestException(mensagemTamanhoAnexo(info.categoria));
  }
  return info;
}
