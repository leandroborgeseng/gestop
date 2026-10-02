export const MAX_ANEXOS_ABERTURA = 8;
export const MAX_ANEXO_ABERTURA_BYTES = 8 * 1024 * 1024;
export const MAX_ANEXO_VIDEO_BYTES = 25 * 1024 * 1024;
export const MAX_TOTAL_ANEXOS_ABERTURA_BYTES = 20 * 1024 * 1024;
export const MAX_TOTAL_ANEXOS_COM_VIDEO_BYTES = 30 * 1024 * 1024;

export const ANEXOS_ABERTURA_FORMATOS = 'JPG, JPEG, PNG, WEBP, PDF, MP4, MOV, M4V, 3GP e WEBM';

export const ANEXOS_ABERTURA_ACCEPT =
  'image/jpeg,image/jpg,image/png,image/webp,.jpg,.jpeg,.png,.webp,application/pdf,.pdf,video/mp4,video/quicktime,video/webm,video/3gpp,.mp4,.mov,.m4v,.3gp,.webm';

export const ANEXOS_ABERTURA_IMAGEM_ACCEPT = 'image/jpeg,image/jpg,image/png,image/webp,.jpg,.jpeg,.png,.webp';

const EXTENSAO_MIME: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  pdf: 'application/pdf',
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  m4v: 'video/x-m4v',
  '3gp': 'video/3gpp',
  webm: 'video/webm',
};

const MIMES_PERMITIDOS = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
  'video/mp4',
  'video/quicktime',
  'video/webm',
  'video/3gpp',
  'video/3gpp2',
  'video/x-m4v',
]);

export type CategoriaAnexo = 'imagem' | 'pdf' | 'video';

export type AnexoAberturaDraft = {
  id: string;
  nome: string;
  mimeType: string;
  dataUrl: string;
  categoria: CategoriaAnexo;
};

export function mensagemArquivoAbertura(file: File, atuais: AnexoAberturaDraft[]) {
  const mime = mimeDeArquivo(file);
  if (!mime) return `Formato não permitido. Formatos permitidos: ${ANEXOS_ABERTURA_FORMATOS}.`;
  const categoria = categoriaDoMime(mime);
  const limite = categoria === 'video' ? MAX_ANEXO_VIDEO_BYTES : MAX_ANEXO_ABERTURA_BYTES;
  if (file.size > limite) {
    return categoria === 'video' ? 'Cada vídeo pode ter no máximo 25 MB.' : 'Cada arquivo pode ter no máximo 8 MB.';
  }
  if (atuais.length >= MAX_ANEXOS_ABERTURA) return 'É possível anexar no máximo 8 arquivos na abertura.';
  const total = atuais.reduce((soma, item) => soma + tamanhoDataUrl(item.dataUrl), 0) + file.size;
  const temVideo = categoria === 'video' || atuais.some((item) => item.categoria === 'video');
  const teto = temVideo ? MAX_TOTAL_ANEXOS_COM_VIDEO_BYTES : MAX_TOTAL_ANEXOS_ABERTURA_BYTES;
  if (total > teto) return temVideo ? 'O total dos anexos passa de 30 MB.' : 'O total dos anexos passa de 20 MB.';
  return null;
}

export function mimeDeArquivo(file: File) {
  const informado = file.type.trim().toLowerCase();
  const normalizado =
    informado === 'image/jpg' || informado === 'image/pjpeg'
      ? 'image/jpeg'
      : informado === 'video/m4v'
        ? 'video/x-m4v'
        : informado === 'video/mov'
          ? 'video/quicktime'
          : informado;
  if (MIMES_PERMITIDOS.has(normalizado)) return normalizado;
  const extensao = file.name.split('.').pop()?.toLowerCase() ?? '';
  const porExtensao = EXTENSAO_MIME[extensao];
  return porExtensao && MIMES_PERMITIDOS.has(porExtensao) ? porExtensao : null;
}

export function categoriaDoMime(mime: string): CategoriaAnexo {
  if (mime === 'application/pdf') return 'pdf';
  if (mime.startsWith('video/')) return 'video';
  return 'imagem';
}

function tamanhoDataUrl(dataUrl: string) {
  const marker = ';base64,';
  const indice = dataUrl.indexOf(marker);
  if (indice < 0) return 0;
  const base64 = dataUrl.slice(indice + marker.length).replace(/\s/g, '');
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor((base64.length * 3) / 4) - padding);
}

export function lerArquivoComoDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(new Error('Não foi possível ler o arquivo.'));
    reader.readAsDataURL(file);
  });
}
