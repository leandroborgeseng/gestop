import PDFDocument from 'pdfkit';

export type PdfTableOptions = {
  title: string;
  subtitle?: string;
  headers: string[];
  rows: string[][];
};

function truncate(value: string, max = 42) {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1)}…`;
}

export function buildTablePdf(options: PdfTableOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 36, size: 'A4', layout: 'landscape' });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(16).fillColor('#0066cc').text(options.title, { align: 'left' });
    doc.moveDown(0.3);
    doc.fontSize(9).fillColor('#444444');
    doc.text(options.subtitle ?? `Gerado em ${new Date().toLocaleString('pt-BR')}`);
    doc.text(`Total de registros: ${options.rows.length}`);
    doc.moveDown(0.8);

    const usableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const columnWidth = usableWidth / options.headers.length;
    const rowHeight = 18;
    let y = doc.y;

    doc.fontSize(8).fillColor('#ffffff');
    options.headers.forEach((header, index) => {
      const x = doc.page.margins.left + index * columnWidth;
      doc.rect(x, y, columnWidth, rowHeight).fill('#0066cc');
      doc.fillColor('#ffffff').text(truncate(header, 24), x + 4, y + 5, {
        width: columnWidth - 8,
        height: rowHeight,
        ellipsis: true,
      });
    });

    y += rowHeight;
    doc.fillColor('#222222');

    for (const row of options.rows) {
      if (y + rowHeight > doc.page.height - doc.page.margins.bottom) {
        doc.addPage({ layout: 'landscape', margin: 36 });
        y = doc.page.margins.top;
      }

      row.forEach((cell, index) => {
        const x = doc.page.margins.left + index * columnWidth;
        doc.rect(x, y, columnWidth, rowHeight).stroke('#dddddd');
        doc.fillColor('#222222').text(truncate(String(cell ?? '')), x + 4, y + 5, {
          width: columnWidth - 8,
          height: rowHeight,
          ellipsis: true,
        });
      });
      y += rowHeight;
    }

    doc.end();
  });
}
