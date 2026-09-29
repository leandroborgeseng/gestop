const LIMITE_BYTES = 180_000;
const LARGURA_MAXIMA = 1200;

/** Reduz foto grande antes de embutir no PDF. Arquivo pequeno segue inteiro. */
export async function shrinkImageForPdf(buffer: Buffer, mimeType: string) {
  if (buffer.length < LIMITE_BYTES) {
    return { buffer, mimeType };
  }

  try {
    const sharp = (await import('sharp')).default;
    const out = await sharp(buffer, { failOn: 'none', animated: false })
      .rotate()
      .resize({ width: LARGURA_MAXIMA, withoutEnlargement: true })
      .jpeg({ quality: 72, mozjpeg: true })
      .toBuffer();
    if (!out.length || out.length >= buffer.length) {
      return { buffer, mimeType };
    }
    return { buffer: out, mimeType: 'image/jpeg' };
  } catch {
    return { buffer, mimeType };
  }
}
