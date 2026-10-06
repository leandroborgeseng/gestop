import { PDFParse } from 'pdf-parse';

export async function extrairTextoPdf(buffer: Buffer): Promise<string> {
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    return (result.text ?? '').replace(/\s+/g, ' ').trim();
  } finally {
    await parser.destroy();
  }
}

export function contarOcorrencias(texto: string, trecho: string) {
  if (!trecho) return 0;
  return texto.split(trecho).length - 1;
}
