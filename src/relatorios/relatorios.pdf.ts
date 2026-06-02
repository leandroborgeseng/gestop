import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import PDFDocument from 'pdfkit';

export type PdfTableOptions = {
  title: string;
  subtitle?: string;
  headers: string[];
  rows: string[][];
};

const BRAND_PRIMARY = '#0066cc';
const TEXT_PRIMARY = '#1a1a1a';
const TEXT_MUTED = '#555555';
const BORDER = '#dddddd';

const LOGO_CANDIDATES = [
  resolve(process.cwd(), 'assets/prefeitura-franca-logo.png'),
  resolve(process.cwd(), 'frontend/public/prefeitura-franca-logo.png'),
];

function truncate(value: string, max = 42) {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1)}…`;
}

function resolveLogoPath() {
  return LOGO_CANDIDATES.find((candidate) => existsSync(candidate)) ?? null;
}

function drawInstitutionalHeader(doc: InstanceType<typeof PDFDocument>, title: string, subtitle: string, totalRows: number) {
  const left = doc.page.margins.left;
  const top = doc.page.margins.top;
  const logoPath = resolveLogoPath();
  let contentTop = top;

  if (logoPath) {
    doc.image(logoPath, left, top, { fit: [150, 52] });
    contentTop = top + 58;
  }

  doc
    .font('Helvetica-Bold')
    .fontSize(14)
    .fillColor(BRAND_PRIMARY)
    .text(title, left, contentTop, { align: 'left' });

  doc
    .font('Helvetica')
    .fontSize(9)
    .fillColor(TEXT_MUTED)
    .text(subtitle, left, doc.y + 2, { align: 'left' })
    .text(`Total de registros: ${totalRows}`, left, doc.y + 2, { align: 'left' });

  doc.moveDown(0.8);
}

function drawTableHeader(
  doc: InstanceType<typeof PDFDocument>,
  headers: string[],
  y: number,
  columnWidth: number,
  rowHeight: number,
) {
  const left = doc.page.margins.left;

  headers.forEach((header, index) => {
    const x = left + index * columnWidth;
    doc.save();
    doc.rect(x, y, columnWidth, rowHeight).fill(BRAND_PRIMARY);
    doc
      .font('Helvetica-Bold')
      .fontSize(8)
      .fillColor('#ffffff')
      .text(truncate(header, 28), x + 4, y + 5, {
        width: columnWidth - 8,
        lineBreak: false,
        ellipsis: true,
      });
    doc.restore();
  });
}

function drawTableRow(
  doc: InstanceType<typeof PDFDocument>,
  row: string[],
  y: number,
  columnWidth: number,
  rowHeight: number,
  zebra: boolean,
) {
  const left = doc.page.margins.left;

  row.forEach((cell, index) => {
    const x = left + index * columnWidth;
    if (zebra) {
      doc.save();
      doc.rect(x, y, columnWidth, rowHeight).fill('#f7f9fc');
      doc.restore();
    }
    doc.rect(x, y, columnWidth, rowHeight).stroke(BORDER);
    doc
      .font('Helvetica')
      .fontSize(8)
      .fillColor(TEXT_PRIMARY)
      .text(truncate(String(cell ?? '')), x + 4, y + 5, {
        width: columnWidth - 8,
        lineBreak: false,
        ellipsis: true,
      });
  });
}

export function buildTablePdf(options: PdfTableOptions): Promise<Buffer> {
  return new Promise((resolvePromise, reject) => {
    const doc = new PDFDocument({ margin: 36, size: 'A4', layout: 'landscape' });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolvePromise(Buffer.concat(chunks)));
    doc.on('error', reject);

    const subtitle = options.subtitle ?? `Gerado em ${new Date().toLocaleString('pt-BR')}`;
    drawInstitutionalHeader(doc, options.title, subtitle, options.rows.length);

    const usableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const columnWidth = usableWidth / Math.max(options.headers.length, 1);
    const rowHeight = 18;
    let y = doc.y;

    drawTableHeader(doc, options.headers, y, columnWidth, rowHeight);
    y += rowHeight;

    options.rows.forEach((row, rowIndex) => {
      if (y + rowHeight > doc.page.height - doc.page.margins.bottom) {
        doc.addPage({ layout: 'landscape', margin: 36 });
        y = doc.page.margins.top;
        drawTableHeader(doc, options.headers, y, columnWidth, rowHeight);
        y += rowHeight;
      }

      drawTableRow(doc, row, y, columnWidth, rowHeight, rowIndex % 2 === 1);
      y += rowHeight;
    });

    doc.end();
  });
}
