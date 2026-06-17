import ExcelJS from 'exceljs';

export async function buildXlsx(
  sheetName: string,
  headers: string[],
  rows: Array<Array<unknown>>,
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'SIGMA';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet(sheetName);
  sheet.addRow(headers);
  sheet.getRow(1).font = { bold: true };

  for (const row of rows) {
    sheet.addRow(row);
  }

  sheet.columns.forEach((column) => {
    let maxWidth = 12;
    column.eachCell?.({ includeEmpty: false }, (cell) => {
      const length = String(cell.value ?? '').length;
      if (length > maxWidth) {
        maxWidth = Math.min(length + 2, 64);
      }
    });
    column.width = maxWidth;
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
