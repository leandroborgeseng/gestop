export const MAX_ANEXOS_ABERTURA = 8;
export const MAX_ANEXO_ABERTURA_BYTES = 8 * 1024 * 1024;
export const MAX_TOTAL_ANEXOS_ABERTURA_BYTES = 20 * 1024 * 1024;

export const ANEXOS_ABERTURA_FORMATOS = 'JPG, JPEG, PNG, WEBP e PDF';

export const ANEXOS_ABERTURA_ACCEPT =
  'image/jpeg,image/jpg,image/png,image/webp,.jpg,.jpeg,.png,.webp,application/pdf,.pdf';

export const ANEXOS_ABERTURA_IMAGEM_ACCEPT = 'image/jpeg,image/jpg,image/png,image/webp,.jpg,.jpeg,.png,.webp';

const EXTENSAO_MIME: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  pdf: 'application/pdf',
};

export type AnexoAberturaDraft = {
  id: string;
  nome: string;
  mimeType: string;
  dataUrl: string;
  categoria: 'imagem' | 'pdf';
};

export function mensagemArquivoAbertura(file: File, atuais: AnexoAberturaDraft[]) {
  const mime = mimeDeArquivo(file);
  if (!mime) return 'Formato não permitido. Use JPG, JPEG, PNG, WEBP ou PDF.';
  if (file.size > MAX_ANEXO_ABERTURA_BYTES) return 'Cada arquivo pode ter no máximo 8 MB.';
  if (atuais.length >= MAX_ANEXOS_ABERTURA) return 'É possível anexar no máximo 8 arquivos na abertura.';
  const total = atuais.reduce((soma, item) => soma + tamanhoDataUrl(item.dataUrl), 0) + file.size;
  if (total > MAX_TOTAL_ANEXOS_ABERTURA_BYTES) return 'O total dos anexos passa de 20 MB.';
  return null;
}

export function mimeDeArquivo(file: File) {
  const informado = file.type.trim().toLowerCase();
  const normalizado = informado === 'image/jpg' ? 'image/jpeg' : informado;
  if (normalizado === 'image/jpeg' || normalizado === 'image/png' || normalizado === 'image/webp' || normalizado === 'application/pdf') {
    return normalizado;
  }
  const extensao = file.name.split('.').pop()?.toLowerCase() ?? '';
  return EXTENSAO_MIME[extensao] ?? null;
}

export function categoriaDoMime(mime: string): 'imagem' | 'pdf' {
  return mime === 'application/pdf' ? 'pdf' : 'imagem';
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
