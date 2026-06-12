export const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

const OPERATIONAL_TIMEZONE = 'America/Sao_Paulo';

export function parseDateKey(dateKey: string): Date {
  return new Date(`${dateKey}T12:00:00.000Z`);
}

export function utcDateKeyFromDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function todayDateKey(timeZone = OPERATIONAL_TIMEZONE): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone }).format(new Date());
}

export function assertValidDateKey(value: string, field: string): string {
  const trimmed = value.trim();
  if (!DATE_KEY_RE.test(trimmed)) {
    throw new Error(`${field} deve estar no formato YYYY-MM-DD.`);
  }
  const parsed = parseDateKey(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`${field} inválida.`);
  }
  return trimmed;
}
