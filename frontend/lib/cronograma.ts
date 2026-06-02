import { CronogramaFrequencia } from '@/lib/types';

export const CRONOGRAMA_FREQUENCIA_LABELS: Record<CronogramaFrequencia, string> = {
  SEMANAL: 'Semanal',
  QUINZENAL: 'Quinzenal',
  MENSAL: 'Mensal',
  BIMESTRAL: 'Bimestral',
  TRIMESTRAL: 'Trimestral',
  SEMESTRAL: 'Semestral',
  ANUAL: 'Anual',
};

export const CRONOGRAMA_FREQUENCIAS = Object.keys(CRONOGRAMA_FREQUENCIA_LABELS) as CronogramaFrequencia[];

export function formatMonthYear(date: Date) {
  return date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
}

export function toInputDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function monthBounds(reference: Date) {
  const start = new Date(reference.getFullYear(), reference.getMonth(), 1);
  const end = new Date(reference.getFullYear(), reference.getMonth() + 1, 0);
  return { start, end };
}

export function buildCalendarCells(reference: Date) {
  const { start, end } = monthBounds(reference);
  const cells: Array<{ date: Date | null; key: string }> = [];
  const leading = start.getDay();

  for (let index = 0; index < leading; index += 1) {
    cells.push({ date: null, key: `empty-start-${index}` });
  }

  for (let day = 1; day <= end.getDate(); day += 1) {
    const date = new Date(reference.getFullYear(), reference.getMonth(), day);
    cells.push({ date, key: toInputDate(date) });
  }

  while (cells.length % 7 !== 0) {
    cells.push({ date: null, key: `empty-end-${cells.length}` });
  }

  return cells;
}
