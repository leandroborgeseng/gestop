import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import PDFDocument from 'pdfkit';

export type PdfTableOptions = {
  title: string;
  subtitle?: string;
  headers: string[];
  rows: string[][];
  /** Pesos relativos das colunas (soma ~1). Se omitido, colunas iguais. */
  columnWeights?: number[];
  /** Quando true, não limita altura da linha nem usa ellipsis (textos longos quebram). */
  wrapFully?: boolean;
  /** Linhas de totalização exibidas após a tabela. */
  summaryLines?: string[];
};

const BRAND_PRIMARY = '#0066cc';
const TEXT_PRIMARY = '#1a1a1a';
const TEXT_MUTED = '#555555';
const BORDER = '#dddddd';
const FONT_SIZE = 7.5;
const CELL_PADDING = 4;
const MIN_ROW_HEIGHT = 16;
const MAX_ROW_HEIGHT = 48;

const LOGO_CANDIDATES = [
  resolve(process.cwd(), 'assets/prefeitura-franca-logo.png'),
  resolve(process.cwd(), 'frontend/public/prefeitura-franca-logo.png'),
];

function resolveLogoPath() {
  return LOGO_CANDIDATES.find((candidate) => existsSync(candidate)) ?? null;
}

function resolveColumnWidths(usableWidth: number, count: number, weights?: number[]) {
  if (!weights?.length || weights.length !== count) {
    const width = usableWidth / Math.max(count, 1);
    return Array.from({ length: count }, () => width);
  }

  const total = weights.reduce((sum, weight) => sum + weight, 0) || 1;
  return weights.map((weight) => (usableWidth * weight) / total);
}

function measureTextHeight(
  doc: InstanceType<typeof PDFDocument>,
  text: string,
  width: number,
  font: 'Helvetica' | 'Helvetica-Bold',
  wrapFully = false,
) {
  doc.font(font).fontSize(FONT_SIZE);
  const height = doc.heightOfString(String(text ?? ''), {
    width: Math.max(width, 8),
    lineGap: 1,
  });
  const padded = Math.max(height + CELL_PADDING * 2, MIN_ROW_HEIGHT);
  return wrapFully ? padded : Math.min(padded, MAX_ROW_HEIGHT);
}

function drawInstitutionalHeader(
  doc: InstanceType<typeof PDFDocument>,
  title: string,
  subtitle: string,
  totalRows: number,
) {
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
  columnWidths: number[],
  wrapFully = false,
) {
  const left = doc.page.margins.left;
  const rowHeight = Math.max(
    ...headers.map((header, index) =>
      measureTextHeight(doc, header, columnWidths[index] - CELL_PADDING * 2, 'Helvetica-Bold', wrapFully),
    ),
  );

  let x = left;
  headers.forEach((header, index) => {
    const width = columnWidths[index];
    doc.save();
    doc.rect(x, y, width, rowHeight).fill(BRAND_PRIMARY);
    doc
      .font('Helvetica-Bold')
      .fontSize(FONT_SIZE)
      .fillColor('#ffffff')
      .text(String(header ?? ''), x + CELL_PADDING, y + CELL_PADDING, {
        width: width - CELL_PADDING * 2,
        lineGap: 1,
      });
    doc.restore();
    x += width;
  });

  return rowHeight;
}

function drawTableRow(
  doc: InstanceType<typeof PDFDocument>,
  row: string[],
  y: number,
  columnWidths: number[],
  zebra: boolean,
  wrapFully = false,
) {
  const left = doc.page.margins.left;
  const normalized = columnWidths.map((_, index) => String(row[index] ?? ''));
  const rowHeight = Math.max(
    ...normalized.map((cell, index) =>
      measureTextHeight(doc, cell, columnWidths[index] - CELL_PADDING * 2, 'Helvetica', wrapFully),
    ),
  );

  let x = left;
  normalized.forEach((cell, index) => {
    const width = columnWidths[index];

    if (zebra) {
      doc.save();
      doc.rect(x, y, width, rowHeight).fill('#f7f9fc');
      doc.restore();
    }

    doc.rect(x, y, width, rowHeight).stroke(BORDER);
    doc
      .font('Helvetica')
      .fontSize(FONT_SIZE)
      .fillColor(TEXT_PRIMARY)
      .text(cell, x + CELL_PADDING, y + CELL_PADDING, {
        width: width - CELL_PADDING * 2,
        lineGap: 1,
        ...(wrapFully ? {} : { ellipsis: true }),
      });

    x += width;
  });

  return rowHeight;
}

export function buildTablePdf(options: PdfTableOptions): Promise<Buffer> {
  return new Promise((resolvePromise, reject) => {
    const doc = new PDFDocument({ margin: 36, size: 'A4', layout: 'landscape' });
    const chunks: Buffer[] = [];
    const wrapFully = Boolean(options.wrapFully);

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolvePromise(Buffer.concat(chunks)));
    doc.on('error', reject);

    const subtitle = options.subtitle ?? `Gerado em ${new Date().toLocaleString('pt-BR')}`;
    drawInstitutionalHeader(doc, options.title, subtitle, options.rows.length);

    const usableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const columnWidths = resolveColumnWidths(usableWidth, options.headers.length, options.columnWeights);
    let y = doc.y;

    y += drawTableHeader(doc, options.headers, y, columnWidths, wrapFully);

    options.rows.forEach((row, rowIndex) => {
      const previewHeight = Math.max(
        ...row.map((cell, index) =>
          measureTextHeight(doc, String(cell ?? ''), columnWidths[index] - CELL_PADDING * 2, 'Helvetica', wrapFully),
        ),
      );

      if (y + previewHeight > doc.page.height - doc.page.margins.bottom) {
        doc.addPage({ layout: 'landscape', margin: 36 });
        y = doc.page.margins.top;
        y += drawTableHeader(doc, options.headers, y, columnWidths, wrapFully);
      }

      y += drawTableRow(doc, row, y, columnWidths, rowIndex % 2 === 1, wrapFully);
    });

    if (options.summaryLines?.length) {
      const needed = options.summaryLines.length * 12 + 24;
      if (y + needed > doc.page.height - doc.page.margins.bottom) {
        doc.addPage({ layout: 'landscape', margin: 36 });
        y = doc.page.margins.top;
      }
      y += 14;
      doc.font('Helvetica-Bold').fontSize(9).fillColor(BRAND_PRIMARY).text('Totalizadores', doc.page.margins.left, y);
      y = doc.y + 4;
      doc.font('Helvetica').fontSize(8).fillColor(TEXT_PRIMARY);
      for (const line of options.summaryLines) {
        doc.text(line, doc.page.margins.left, y, {
          width: usableWidth,
          lineGap: 1,
        });
        y = doc.y + 2;
      }
    }

    doc.end();
  });
}
