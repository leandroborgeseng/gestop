import { createHash } from 'node:crypto';
import { PDFDocument, PDFString, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import QRCode from 'qrcode';
import { summarizeForPdfDisplay, wrapPdfText } from './documentos-validation';

export type AssinaturaPdfAppend = {
  assinanteNome: string;
  assinanteDocumento?: string | null;
  assinanteEmail?: string | null;
  qualificacao?: string | null;
  coletadaEm: string;
  imageBuffer?: Buffer | null;
};

export type AuthBlockAppend = {
  codigo: string;
  codigoValidacao: string;
  codigoVerificador: string;
  situacaoLabel: string;
  geradoEm: string;
  validationUrl: string;
  hashResumo?: string | null;
};

function drawWrappedText(
  page: PDFPage,
  text: string,
  opts: {
    x: number;
    y: number;
    size: number;
    font: PDFFont;
    maxWidth: number;
    lineHeight: number;
    color: ReturnType<typeof rgb>;
    maxCharsPerLine: number;
  },
) {
  const lines = wrapPdfText(text, opts.maxCharsPerLine);
  let y = opts.y;
  for (const line of lines) {
    page.drawText(line, {
      x: opts.x,
      y,
      size: opts.size,
      font: opts.font,
      color: opts.color,
      maxWidth: opts.maxWidth,
    });
    y -= opts.lineHeight;
  }
  return y;
}

/** Hyperlink URI em área retangular (coordenadas pdf-lib: origem inferior esquerda). */
function addUriLink(page: PDFPage, opts: { x: number; y: number; width: number; height: number; url: string }) {
  const context = page.doc.context;
  const annotRef = context.register(
    context.obj({
      Type: 'Annot',
      Subtype: 'Link',
      Rect: [opts.x, opts.y, opts.x + opts.width, opts.y + opts.height],
      Border: [0, 0, 0],
      A: {
        Type: 'Action',
        S: 'URI',
        URI: PDFString.of(opts.url),
      },
    }),
  );
  page.node.addAnnot(annotRef);
}

/**
 * Acrescenta assinaturas e um bloco de autenticidade da versão assinada vigente.
 * O hash exibido é o do conteúdo assinado (base + assinaturas), sem o selo final.
 * A situação deve ser sempre a da versão assinada (ex.: Assinado vigente).
 */
export async function appendAssinaturasAoPdfOriginal(
  originalPdf: Buffer,
  assinaturas: AssinaturaPdfAppend[],
  auth: AuthBlockAppend,
): Promise<{ pdfBuffer: Buffer; hashConteudoAssinado: string; hashArquivoFinal: string }> {
  const base = await PDFDocument.load(originalPdf);
  const out = await PDFDocument.create();
  const copied = await out.copyPages(base, base.getPageIndices());
  for (const page of copied) out.addPage(page);

  const font = await out.embedFont(StandardFonts.Helvetica);
  const fontBold = await out.embedFont(StandardFonts.HelveticaBold);

  let page = out.addPage([595.28, 841.89]);
  let y = page.getHeight() - 50;
  const left = 40;
  const width = page.getWidth() - 80;

  const ensure = (needed: number) => {
    if (y - needed < 50) {
      page = out.addPage([595.28, 841.89]);
      y = page.getHeight() - 50;
    }
  };

  ensure(30);
  page.drawText('Assinaturas externas', {
    x: left,
    y,
    size: 14,
    font: fontBold,
    color: rgb(0, 0.4, 0.8),
  });
  y -= 24;

  for (const assinatura of assinaturas) {
    ensure(140);
    page.drawText(assinatura.assinanteNome, {
      x: left,
      y,
      size: 11,
      font: fontBold,
      color: rgb(0.1, 0.1, 0.1),
    });
    y -= 16;
    const detalhes = [
      assinatura.qualificacao ? `Qualificação: ${assinatura.qualificacao}` : null,
      assinatura.assinanteDocumento ? `CPF: ${assinatura.assinanteDocumento}` : null,
      assinatura.assinanteEmail ? `E-mail: ${assinatura.assinanteEmail}` : null,
      `Em: ${new Date(assinatura.coletadaEm).toLocaleString('pt-BR')}`,
    ]
      .filter(Boolean)
      .join(' · ');
    y = drawWrappedText(page, detalhes, {
      x: left,
      y,
      size: 9,
      font,
      maxWidth: width,
      lineHeight: 12,
      color: rgb(0.35, 0.35, 0.35),
      maxCharsPerLine: 95,
    });
    y -= 6;

    if (assinatura.imageBuffer?.length) {
      try {
        const embedded =
          assinatura.imageBuffer[0] === 0x89
            ? await out.embedPng(assinatura.imageBuffer)
            : await out.embedJpg(assinatura.imageBuffer);
        const maxW = 240;
        const maxH = 80;
        const scale = Math.min(maxW / embedded.width, maxH / embedded.height, 1);
        const drawW = embedded.width * scale;
        const drawH = embedded.height * scale;
        ensure(drawH + 20);
        page.drawImage(embedded, { x: left, y: y - drawH, width: drawW, height: drawH });
        y -= drawH + 16;
      } catch {
        y -= 8;
      }
    }

    page.drawLine({
      start: { x: left, y },
      end: { x: left + width, y },
      thickness: 0.5,
      color: rgb(0.8, 0.8, 0.8),
    });
    y -= 18;
  }

  const draftBytes = await out.save();
  const hashConteudoAssinado = createHash('sha256').update(draftBytes).digest('hex');

  // Recarrega e adiciona página exclusiva de autenticidade da versão assinada.
  const finalDoc = await PDFDocument.load(draftBytes);
  const font2 = await finalDoc.embedFont(StandardFonts.Helvetica);
  const fontBold2 = await finalDoc.embedFont(StandardFonts.HelveticaBold);
  const qrPng = await QRCode.toBuffer(auth.validationUrl, {
    type: 'png',
    margin: 1,
    width: 140,
    errorCorrectionLevel: 'M',
  });
  const qrImage = await finalDoc.embedPng(qrPng);

  const authPage = finalDoc.addPage([595.28, 841.89]);
  const authYTop = authPage.getHeight() - 50;
  const hashDisplay = summarizeForPdfDisplay(hashConteudoAssinado, 16);
  const qrSize = 96;
  const qrGap = 14;
  const textColWidth = Math.max(220, width - qrSize - qrGap - 20);
  const maxChars = Math.max(36, Math.floor(textColWidth / 4.6));
  const linkLabel = 'Acessar validação do documento';

  const authLines = [
    'Versão assinada vigente — situação atual deste PDF.',
    'Conferência pelo QR Code ou pela página pública (código do documento + verificador).',
    `Código do documento: ${auth.codigo}`,
    `Código verificador: ${auth.codigoVerificador}`,
    `Código de validação: ${auth.codigoValidacao}`,
    `Situação: ${auth.situacaoLabel}`,
    `Gerado em: ${auth.geradoEm}`,
    `Hash (PDF assinado): ${hashDisplay}`,
  ];

  let estimatedHeight = 52;
  for (const line of authLines) {
    estimatedHeight += wrapPdfText(line, maxChars).length * 11 + 2;
  }
  const boxHeight = Math.max(168, Math.min(240, estimatedHeight));
  const boxTop = authYTop;

  authPage.drawRectangle({
    x: left,
    y: boxTop - boxHeight,
    width,
    height: boxHeight,
    borderColor: rgb(0.8, 0.8, 0.8),
    borderWidth: 1,
  });
  authPage.drawText('Autenticidade do documento', {
    x: left + 10,
    y: boxTop - 18,
    size: 11,
    font: fontBold2,
    color: rgb(0, 0.4, 0.8),
    maxWidth: textColWidth,
  });

  let textY = boxTop - 34;
  for (const line of authLines) {
    textY = drawWrappedText(authPage, line, {
      x: left + 10,
      y: textY,
      size: 8,
      font: font2,
      maxWidth: textColWidth,
      lineHeight: 11,
      color: rgb(0.2, 0.2, 0.2),
      maxCharsPerLine: maxChars,
    });
    textY -= 2;
  }

  textY -= 4;
  const linkSize = 8;
  const linkWidth = Math.min(textColWidth, font2.widthOfTextAtSize(linkLabel, linkSize) + 2);
  authPage.drawText(linkLabel, {
    x: left + 10,
    y: textY,
    size: linkSize,
    font: font2,
    color: rgb(0, 0.4, 0.8),
    maxWidth: textColWidth,
  });
  addUriLink(authPage, {
    x: left + 10,
    y: textY - 2,
    width: linkWidth,
    height: linkSize + 4,
    url: auth.validationUrl,
  });

  authPage.drawImage(qrImage, {
    x: left + width - qrSize - 10,
    y: Math.max(boxTop - boxHeight + 10, boxTop - qrSize - 18),
    width: qrSize,
    height: qrSize,
  });

  const pdfBuffer = Buffer.from(await finalDoc.save());
  const hashArquivoFinal = createHash('sha256').update(pdfBuffer).digest('hex');
  return { pdfBuffer, hashConteudoAssinado, hashArquivoFinal };
}
