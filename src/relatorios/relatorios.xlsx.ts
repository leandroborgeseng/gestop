import ExcelJS from 'exceljs';

function normalizeCellValue(value: unknown): string | number | boolean | Date | null {
  if (value == null) return '';
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (value instanceof Date) return value;
  if (typeof value === 'object') return String(value);
  return String(value);
}

export async function buildXlsx(
  sheetName: string,
  headers: string[],
  rows: Array<Array<unknown>>,
  options?: { wrapText?: boolean; summaryLines?: string[] },
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'SIGMA';
  workbook.created = new Date();

  const safeSheetName = sheetName.replace(/[\\/*?:[\]]/g, ' ').slice(0, 31) || 'Dados';
  const sheet = workbook.addWorksheet(safeSheetName);

  sheet.addRow(headers.map(normalizeCellValue));
  sheet.getRow(1).font = { bold: true };

  for (const row of rows) {
    sheet.addRow(row.map(normalizeCellValue));
  }

  if (options?.summaryLines?.length) {
    sheet.addRow([]);
    sheet.addRow(['Totalizadores']).font = { bold: true };
    for (const line of options.summaryLines) {
      sheet.addRow([line]);
    }
  }

  sheet.columns.forEach((column) => {
    let maxWidth = 12;
    column.eachCell?.({ includeEmpty: false }, (cell) => {
      const length = String(cell.value ?? '').length;
      if (length > maxWidth) {
        maxWidth = Math.min(length + 2, options?.wrapText ? 48 : 64);
      }
      if (options?.wrapText) {
        cell.alignment = { ...(cell.alignment ?? {}), wrapText: true, vertical: 'top' };
      }
    });
    column.width = maxWidth;
  });

  if (options?.wrapText) {
    sheet.eachRow((row) => {
      let maxLines = 1;
      row.eachCell((cell) => {
        const text = String(cell.value ?? '');
        const lines = text.split(/\r?\n|; /).reduce((acc, part) => acc + Math.ceil(Math.max(part.length, 1) / 40), 0);
        maxLines = Math.max(maxLines, lines, text.split(/\r?\n/).length);
      });
      row.height = Math.min(15 * Math.max(maxLines, 1), 120);
    });
  }

  const data = await workbook.xlsx.writeBuffer();
  if (Buffer.isBuffer(data)) {
    return data;
  }

  return Buffer.from(new Uint8Array(data as ArrayBuffer));
}

export function isXlsxBuffer(buffer: Buffer) {
  return buffer.length >= 2 && buffer[0] === 0x50 && buffer[1] === 0x4b;
}
