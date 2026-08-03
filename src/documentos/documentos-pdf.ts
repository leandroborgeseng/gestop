import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import { summarizeForPdfDisplay } from './documentos-validation';

const BRAND = '#0066cc';
const TEXT = '#1a1a1a';
const MUTED = '#555555';
const BORDER = '#dddddd';

const LOGO_CANDIDATES = [
  resolve(process.cwd(), 'assets/prefeitura-franca-logo.png'),
  resolve(process.cwd(), 'frontend/public/prefeitura-franca-logo.png'),
];

export type DocumentoPdfAnexo = {
  legenda: string;
  mimeType?: string | null;
  nomeArquivo?: string | null;
  imageBuffer?: Buffer | null;
};

export type DocumentoPdfResposta = {
  codigo: string;
  titulo: string;
  tipo: string;
  respostaTexto: string;
  comentario?: string | null;
  conformidade?: string | null;
  evidencias: DocumentoPdfAnexo[];
};

export type DocumentoPdfAssinatura = {
  assinanteNome: string;
  assinanteDocumento?: string | null;
  assinanteEmail?: string | null;
  qualificacao?: string | null;
  coletadaEm: string;
  imageBuffer?: Buffer | null;
};

export type DocumentoPdfInput = {
  codigo: string;
  codigoValidacao: string;
  codigoVerificador: string;
  tipoLabel: string;
  situacaoLabel: string;
  origemLabel: string;
  titulo: string;
  secretariaLabel: string;
  unidadeLabel?: string | null;
  endereco?: string | null;
  chamadoCodigo?: string | null;
  vistoriaLabel?: string | null;
  checklistLabel?: string | null;
  responsavelLabel?: string | null;
  criadoEm: string;
  geradoEm: string;
  validationUrl: string;
  hashResumo?: string | null;
  respostas: DocumentoPdfResposta[];
  assinaturas?: DocumentoPdfAssinatura[];
  incluirAssinaturas: boolean;
  /** Quando false, gera só o conteúdo (base para PDF assinado). Default true. */
  incluirBlocoAutenticidade?: boolean;
};

function ensureSpace(doc: PDFKit.PDFDocument, y: number, needed: number, marginTop: number) {
  const bottom = doc.page.height - doc.page.margins.bottom;
  if (y + needed <= bottom) return y;
  doc.addPage();
  return marginTop;
}

function resolveLogoPath() {
  return LOGO_CANDIDATES.find((candidate) => existsSync(candidate)) ?? null;
}

function drawAnexo(
  doc: PDFKit.PDFDocument,
  anexo: DocumentoPdfAnexo,
  left: number,
  width: number,
  y: number,
  marginTop: number,
) {
  y = ensureSpace(doc, y, 20, marginTop);
  doc.font('Helvetica').fontSize(8).fillColor(MUTED).text(anexo.legenda, left, y, { width });
  y = doc.y + 3;
  if (anexo.imageBuffer?.length) {
    try {
      const img = (doc as PDFKit.PDFDocument & { openImage: (b: Buffer) => { width: number; height: number } }).openImage(
        anexo.imageBuffer,
      );
      const maxW = Math.max(80, (width - 8) * 0.5);
      const maxH = 180;
      const scale = Math.min(maxW / img.width, maxH / img.height, 1);
      const drawW = img.width * scale;
      const drawH = img.height * scale;
      y = ensureSpace(doc, y, drawH + 10, marginTop);
      doc.image(anexo.imageBuffer, left, y, { width: drawW, height: drawH });
      y += drawH + 10;
      return y;
    } catch {
      // fallthrough
    }
  }
  doc.font('Helvetica').fontSize(8).fillColor(MUTED).text(`Anexo: ${anexo.nomeArquivo ?? anexo.mimeType ?? 'arquivo'}`, left, y);
  return doc.y + 6;
}

async function buildQrPng(url: string) {
  return QRCode.toBuffer(url, { type: 'png', margin: 1, width: 140, errorCorrectionLevel: 'M' });
}

export async function buildDocumentoPdf(input: DocumentoPdfInput): Promise<Buffer> {
  const qrBuffer = await buildQrPng(input.validationUrl);

  return new Promise((resolvePromise, reject) => {
    const doc = new PDFDocument({ margin: 40, size: 'A4', layout: 'portrait' });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    doc.on('end', () => resolvePromise(Buffer.concat(chunks)));
    doc.on('error', reject);

    const left = doc.page.margins.left;
    const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const marginTop = doc.page.margins.top;
    let y = marginTop;

    const logoPath = resolveLogoPath();
    if (logoPath) {
      doc.image(logoPath, left, y, { fit: [90, 32] });
    }
    doc.font('Helvetica-Bold').fontSize(14).fillColor(BRAND).text('SIGMA · Documento', left + 100, y);
    doc.font('Helvetica').fontSize(9).fillColor(MUTED).text(input.codigo, left + 100, y + 18);
    y += 48;

    doc.font('Helvetica-Bold').fontSize(12).fillColor(TEXT).text(input.titulo, left, y, { width });
    y = doc.y + 10;

    const meta: Array<[string, string]> = [
      ['Tipo', input.tipoLabel],
      ['Situação', input.situacaoLabel],
      ['Origem', input.origemLabel],
      ['Secretaria', input.secretariaLabel],
      ['Próprio / local', input.unidadeLabel || input.endereco || '—'],
      ['Endereço', input.endereco || '—'],
      ['Chamado', input.chamadoCodigo || '—'],
      ['Vistoria', input.vistoriaLabel || '—'],
      ['Checklist', input.checklistLabel || '—'],
      ['Responsável', input.responsavelLabel || '—'],
      ['Criado em', input.criadoEm],
      ['Gerado em', input.geradoEm],
    ];

    for (const [label, value] of meta) {
      y = ensureSpace(doc, y, 16, marginTop);
      doc.font('Helvetica-Bold').fontSize(8).fillColor(MUTED).text(label, left, y, { width: 110 });
      doc.font('Helvetica').fontSize(9).fillColor(TEXT).text(value, left + 120, y, { width: width - 120 });
      y = Math.max(doc.y, y) + 4;
    }

    if (input.respostas.length) {
      y = ensureSpace(doc, y, 28, marginTop);
      y += 8;
      doc.font('Helvetica-Bold').fontSize(11).fillColor(BRAND).text('Perguntas e respostas', left, y);
      y = doc.y + 8;

      for (const resposta of input.respostas) {
        y = ensureSpace(doc, y, 40, marginTop);
        doc.font('Helvetica-Bold').fontSize(9).fillColor(TEXT).text(`${resposta.codigo} · ${resposta.titulo}`, left, y, {
          width,
        });
        y = doc.y + 2;
        doc.font('Helvetica').fontSize(9).fillColor(TEXT).text(`Resposta: ${resposta.respostaTexto}`, left, y, { width });
        y = doc.y + 2;
        if (resposta.conformidade) {
          doc.font('Helvetica').fontSize(8).fillColor(MUTED).text(`Conformidade: ${resposta.conformidade}`, left, y);
          y = doc.y + 2;
        }
        if (resposta.comentario) {
          doc.font('Helvetica').fontSize(8).fillColor(MUTED).text(`Obs.: ${resposta.comentario}`, left, y, { width });
          y = doc.y + 2;
        }
        for (const evidencia of resposta.evidencias) {
          y = drawAnexo(doc, evidencia, left, width, y, marginTop);
        }
        y += 8;
      }
    }

    if (input.incluirAssinaturas && input.assinaturas?.length) {
      y = ensureSpace(doc, y, 40, marginTop);
      doc.font('Helvetica-Bold').fontSize(11).fillColor(BRAND).text('Assinaturas externas', left, y);
      y = doc.y + 8;

      for (const assinatura of input.assinaturas) {
        y = ensureSpace(doc, y, 70, marginTop);
        doc
          .font('Helvetica-Bold')
          .fontSize(9)
          .fillColor(TEXT)
          .text(assinatura.assinanteNome, left, y, { width: width * 0.6 });
        y = doc.y + 2;
        const detalhes = [
          assinatura.qualificacao ? `Qualificação: ${assinatura.qualificacao}` : null,
          assinatura.assinanteDocumento ? `CPF: ${assinatura.assinanteDocumento}` : null,
          assinatura.assinanteEmail ? `E-mail: ${assinatura.assinanteEmail}` : null,
          `Em: ${assinatura.coletadaEm}`,
        ]
          .filter(Boolean)
          .join(' · ');
        doc.font('Helvetica').fontSize(8).fillColor(MUTED).text(detalhes, left, y, { width: width * 0.65 });
        y = doc.y + 4;
        if (assinatura.imageBuffer?.length) {
          try {
            doc.image(assinatura.imageBuffer, left, y, { fit: [220, 70] });
            y += 78;
          } catch {
            y += 8;
          }
        }
        doc.moveTo(left, y).lineTo(left + width, y).strokeColor(BORDER).stroke();
        y += 10;
      }
    }

    if (input.incluirBlocoAutenticidade !== false) {
      // ~3/4 texto · ~1/4 QR — evita sobreposição e URL truncada auto-linkada incompleta.
      const qrSize = 96;
      const qrGap = 14;
      const textColWidth = Math.max(220, width - qrSize - qrGap - 20);
      const hashRaw = input.hashResumo?.replace(/…$/, '') ?? null;
      const hashDisplay = hashRaw ? summarizeForPdfDisplay(hashRaw, 16) : null;
      const linkLabel = 'Acessar validação do documento';

      y = ensureSpace(doc, y, 200, marginTop);
      y += 8;
      const blockTop = y;
      const blockHeight = 178;
      doc.rect(left, blockTop, width, blockHeight).strokeColor(BORDER).stroke();

      let cursorY = blockTop + 10;
      doc.font('Helvetica-Bold').fontSize(10).fillColor(BRAND).text('Autenticidade do documento', left + 10, cursorY, {
        width: textColWidth,
      });
      cursorY = doc.y + 4;
      doc
        .font('Helvetica')
        .fontSize(7.5)
        .fillColor(TEXT)
        .text(
          'Documento original. Conferência pelo QR Code ou pela página pública (código do documento + verificador).',
          left + 10,
          cursorY,
          { width: textColWidth },
        );
      cursorY = doc.y + 6;
      doc.font('Helvetica').fontSize(8).fillColor(MUTED);
      doc.text(`Código do documento: ${input.codigo}`, left + 10, cursorY, { width: textColWidth });
      cursorY = doc.y + 2;
      doc.text(`Código verificador: ${input.codigoVerificador}`, left + 10, cursorY, { width: textColWidth });
      cursorY = doc.y + 2;
      doc.text(`Código de validação: ${input.codigoValidacao}`, left + 10, cursorY, { width: textColWidth });
      cursorY = doc.y + 2;
      doc.text(`Situação: ${input.situacaoLabel}`, left + 10, cursorY, { width: textColWidth });
      cursorY = doc.y + 2;
      doc.text(`Gerado em: ${input.geradoEm}`, left + 10, cursorY, { width: textColWidth });
      cursorY = doc.y + 2;
      if (hashDisplay) {
        doc.text(`Hash (PDF original): ${hashDisplay}`, left + 10, cursorY, { width: textColWidth });
        cursorY = doc.y + 4;
      } else {
        cursorY += 2;
      }
      // Texto curto em uma linha com hyperlink para a URL pública completa (QR usa a mesma URL).
      doc
        .font('Helvetica')
        .fontSize(8)
        .fillColor(BRAND)
        .text(linkLabel, left + 10, cursorY, {
          width: textColWidth,
          link: input.validationUrl,
          underline: true,
        });
      doc.image(qrBuffer, left + width - qrSize - 10, blockTop + 14, { fit: [qrSize, qrSize] });
    }

    doc.end();
  });
}
