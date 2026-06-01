export function escapeCsvValue(value: unknown) {
  if (value === null || value === undefined) return '';
  const text = String(value);
  if (/[",\n\r;]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function buildCsv(headers: string[], rows: Array<Array<unknown>>) {
  const lines = [
    headers.map(escapeCsvValue).join(','),
    ...rows.map((row) => row.map(escapeCsvValue).join(',')),
  ];
  return `\uFEFF${lines.join('\n')}`;
}

export function formatIsoDate(value?: Date | string | null) {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString();
}
