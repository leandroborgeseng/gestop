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

/** Deslocamento (ms) do fuso em relação ao UTC no instante dado; calculado pelo Intl (sem -03 fixo). */
export function offsetFusoMs(instante: Date, timeZone = OPERATIONAL_TIMEZONE): number {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(instante);
  const v = (tipo: string) => Number(partes.find((p) => p.type === tipo)?.value);
  const comoUtc = Date.UTC(v('year'), v('month') - 1, v('day'), v('hour'), v('minute'), v('second'));
  return comoUtc - (instante.getTime() - instante.getMilliseconds());
}

/**
 * 295 · Instante UTC da meia-noite (00:00) do dia civil `dateKey` (YYYY-MM-DD) no fuso operacional.
 * O deslocamento é resolvido para aquele dia (funciona com ou sem horário de verão).
 */
export function inicioDoDiaNoFuso(dateKey: string, timeZone = OPERATIONAL_TIMEZONE): Date {
  const [ano, mes, dia] = assertValidDateKey(dateKey, 'Data').split('-').map(Number);
  const meiaNoiteUtc = Date.UTC(ano, mes - 1, dia);
  const primeira = meiaNoiteUtc - offsetFusoMs(new Date(meiaNoiteUtc), timeZone);
  // Segunda passada: o deslocamento correto é o do próprio instante (troca de horário perto da meia-noite).
  const segunda = meiaNoiteUtc - offsetFusoMs(new Date(primeira), timeZone);
  // Se a meia-noite não existe (início do horário de verão), o dia começa no primeiro instante que cai nele.
  return new Date(todayDateKeyEm(new Date(segunda), timeZone) === dateKey ? segunda : primeira);
}

function todayDateKeyEm(instante: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone }).format(instante);
}

/** Dia civil seguinte (YYYY-MM-DD), sem depender de fuso. */
export function proximoDateKey(dateKey: string): string {
  const [ano, mes, dia] = dateKey.split('-').map(Number);
  return new Date(Date.UTC(ano, mes - 1, dia + 1)).toISOString().slice(0, 10);
}
