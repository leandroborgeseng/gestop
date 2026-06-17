import { StreamableFile } from '@nestjs/common';

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export function streamXlsx(buffer: Buffer, filename: string) {
  return new StreamableFile(buffer, {
    type: XLSX_MIME,
    disposition: `attachment; filename="${filename}"`,
    length: buffer.length,
  });
}

export function isBinaryExportPath(path: string) {
  return /\.(xlsx|pdf)$/i.test(path);
}

export function isSpreadsheetContentType(contentType: string | null) {
  if (!contentType) return false;
  const normalized = contentType.toLowerCase();
  return (
    normalized.includes('spreadsheetml') ||
    normalized.includes('application/vnd.ms-excel') ||
    normalized.includes('application/octet-stream')
  );
}

export function isPdfContentType(contentType: string | null) {
  return Boolean(contentType?.toLowerCase().includes('application/pdf'));
}
