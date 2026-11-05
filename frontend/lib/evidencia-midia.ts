/** #311 CCO-V4 — separa foto (lightbox) de anexo não-imagem (abrir/baixar). */
export type EvidenciaMidia = {
  id: string;
  url: string;
  tipo?: string | null;
  mimeType?: string | null;
};

const TIPOS_IMAGEM = new Set(['FOTO', 'ASSINATURA']);
const TIPOS_NAO_IMAGEM = new Set(['VIDEO', 'AUDIO', 'DOCUMENTO']);

export function isEvidenciaImagem(e: Pick<EvidenciaMidia, 'tipo' | 'mimeType' | 'url'>): boolean {
  const tipo = (e.tipo ?? '').toUpperCase();
  if (TIPOS_IMAGEM.has(tipo)) return true;
  if (TIPOS_NAO_IMAGEM.has(tipo)) return false;
  const mime = (e.mimeType ?? '').toLowerCase();
  if (mime.startsWith('image/')) return true;
  if (mime && !mime.startsWith('image/')) return false;
  return /\.(jpe?g|png|gif|webp|bmp|svg)(\?|#|$)/i.test(e.url ?? '');
}

export function rotuloAnexo(e: EvidenciaMidia, index: number): string {
  const mime = (e.mimeType ?? '').toLowerCase();
  if (mime.includes('pdf') || e.url.toLowerCase().includes('.pdf')) return `Anexo ${index + 1}.pdf`;
  if (e.tipo === 'VIDEO') return `Vídeo ${index + 1}`;
  if (e.tipo === 'AUDIO') return `Áudio ${index + 1}`;
  return `Anexo ${index + 1}`;
}

export function particionarEvidencias<T extends EvidenciaMidia>(items: T[]): { fotos: T[]; anexos: T[] } {
  const fotos: T[] = [];
  const anexos: T[] = [];
  for (const item of items) {
    if (isEvidenciaImagem(item)) fotos.push(item);
    else anexos.push(item);
  }
  return { fotos, anexos };
}
