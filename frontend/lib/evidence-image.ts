/** Limite de arquivo selecionado na câmera/galeria (antes de compressão). */
export const MAX_EVIDENCE_INPUT_BYTES = 30 * 1024 * 1024;

/** Acima deste tamanho (ou formatos pesados), reduz resolução/qualidade para caber no upload. */
export const COMPRESS_EVIDENCE_ABOVE_BYTES = 6 * 1024 * 1024;

const MAX_EDGE_PX = 2560;
const TARGET_MAX_BYTES = 22 * 1024 * 1024;

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Falha ao ler a foto.'));
    reader.readAsDataURL(file);
  });
}

function dataUrlByteLength(dataUrl: string) {
  const base64 = dataUrl.split(',')[1] ?? '';
  return Math.ceil((base64.length * 3) / 4);
}

function loadImageFromFile(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Não foi possível abrir a foto. Tente JPEG ou PNG.'));
    };
    image.src = url;
  });
}

async function compressImageFile(file: File) {
  const image = await loadImageFromFile(file);
  const longestEdge = Math.max(image.naturalWidth, image.naturalHeight);
  const scale = longestEdge > MAX_EDGE_PX ? MAX_EDGE_PX / longestEdge : 1;
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Não foi possível processar a foto neste dispositivo.');
  }
  context.drawImage(image, 0, 0, width, height);

  let quality = 0.9;
  let dataUrl = canvas.toDataURL('image/jpeg', quality);
  while (dataUrlByteLength(dataUrl) > TARGET_MAX_BYTES && quality > 0.55) {
    quality -= 0.07;
    dataUrl = canvas.toDataURL('image/jpeg', quality);
  }

  if (dataUrlByteLength(dataUrl) > TARGET_MAX_BYTES) {
    throw new Error(
      'Foto ainda muito grande após otimização. Tire uma nova foto mais próxima ou com menor resolução.',
    );
  }

  return { dataUrl, mimeType: 'image/jpeg' };
}

function isLikelyImageFile(file: File) {
  if (file.type.startsWith('image/')) return true;
  return /\.(jpe?g|png|webp|heic|heif)$/i.test(file.name);
}

/**
 * Prepara foto de evidência de execução em campo.
 * Aceita tamanho típico de celular; comprime só quando necessário para o upload.
 */
export async function prepareEvidenceImage(file: File) {
  if (!isLikelyImageFile(file)) {
    throw new Error('Selecione uma foto (JPEG, PNG, WebP ou HEIC).');
  }

  if (file.size > MAX_EVIDENCE_INPUT_BYTES) {
    throw new Error('Foto muito grande. O limite é 30 MB — escolha outra imagem ou tire uma nova foto.');
  }

  const isJpeg = /^image\/jpe?g$/i.test(file.type) || /\.jpe?g$/i.test(file.name);
  if (file.size <= COMPRESS_EVIDENCE_ABOVE_BYTES && isJpeg) {
    return { dataUrl: await readFileAsDataUrl(file), mimeType: file.type || 'image/jpeg' };
  }

  return compressImageFile(file);
}

export function formatEvidenceSizeLimitMb() {
  return `${Math.round(MAX_EVIDENCE_INPUT_BYTES / (1024 * 1024))} MB`;
}
