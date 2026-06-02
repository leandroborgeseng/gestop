import { CronogramaFrequencia } from '@prisma/client';

export type CalendarioEventoTipo = 'AGENDADA' | 'REALIZADA' | 'ATRASADA';

export function startOfDay(date: Date) {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
}

export function toDateKey(date: Date) {
  return startOfDay(date).toISOString().slice(0, 10);
}

export function addFrequency(date: Date, frequencia: CronogramaFrequencia) {
  const next = new Date(date);

  switch (frequencia) {
    case CronogramaFrequencia.SEMANAL:
      next.setDate(next.getDate() + 7);
      break;
    case CronogramaFrequencia.QUINZENAL:
      next.setDate(next.getDate() + 14);
      break;
    case CronogramaFrequencia.MENSAL:
      next.setMonth(next.getMonth() + 1);
      break;
    case CronogramaFrequencia.BIMESTRAL:
      next.setMonth(next.getMonth() + 2);
      break;
    case CronogramaFrequencia.TRIMESTRAL:
      next.setMonth(next.getMonth() + 3);
      break;
    case CronogramaFrequencia.SEMESTRAL:
      next.setMonth(next.getMonth() + 6);
      break;
    case CronogramaFrequencia.ANUAL:
      next.setFullYear(next.getFullYear() + 1);
      break;
    default:
      break;
  }

  return startOfDay(next);
}

export function subtractFrequency(date: Date, frequencia: CronogramaFrequencia) {
  const previous = new Date(date);

  switch (frequencia) {
    case CronogramaFrequencia.SEMANAL:
      previous.setDate(previous.getDate() - 7);
      break;
    case CronogramaFrequencia.QUINZENAL:
      previous.setDate(previous.getDate() - 14);
      break;
    case CronogramaFrequencia.MENSAL:
      previous.setMonth(previous.getMonth() - 1);
      break;
    case CronogramaFrequencia.BIMESTRAL:
      previous.setMonth(previous.getMonth() - 2);
      break;
    case CronogramaFrequencia.TRIMESTRAL:
      previous.setMonth(previous.getMonth() - 3);
      break;
    case CronogramaFrequencia.SEMESTRAL:
      previous.setMonth(previous.getMonth() - 6);
      break;
    case CronogramaFrequencia.ANUAL:
      previous.setFullYear(previous.getFullYear() - 1);
      break;
    default:
      break;
  }

  return startOfDay(previous);
}

export function projectChecagensNoPeriodo(input: {
  proximaChecagemEm: Date;
  frequencia: CronogramaFrequencia;
  from: Date;
  to: Date;
}) {
  const from = startOfDay(input.from);
  const to = startOfDay(input.to);
  const dates: Date[] = [];

  let current = startOfDay(input.proximaChecagemEm);

  while (current > to) {
    current = subtractFrequency(current, input.frequencia);
  }

  let guard = 0;
  while (current < from && guard < 500) {
    current = addFrequency(current, input.frequencia);
    guard += 1;
  }

  guard = 0;
  while (current <= to && guard < 500) {
    if (current >= from) {
      dates.push(new Date(current));
    }
    current = addFrequency(current, input.frequencia);
    guard += 1;
  }

  return dates;
}

export function resolveEventoTipo(data: Date, hoje = startOfDay(new Date())): CalendarioEventoTipo {
  const dia = startOfDay(data);
  return dia < hoje ? 'ATRASADA' : 'AGENDADA';
}

export const CRONOGRAMA_FREQUENCIA_LABELS: Record<CronogramaFrequencia, string> = {
  [CronogramaFrequencia.SEMANAL]: 'Semanal',
  [CronogramaFrequencia.QUINZENAL]: 'Quinzenal',
  [CronogramaFrequencia.MENSAL]: 'Mensal',
  [CronogramaFrequencia.BIMESTRAL]: 'Bimestral',
  [CronogramaFrequencia.TRIMESTRAL]: 'Trimestral',
  [CronogramaFrequencia.SEMESTRAL]: 'Semestral',
  [CronogramaFrequencia.ANUAL]: 'Anual',
};
