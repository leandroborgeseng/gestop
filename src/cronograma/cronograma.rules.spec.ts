import { CronogramaFrequencia } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { addFrequency, projectChecagensNoPeriodo, startOfDay } from './cronograma.rules';

describe('cronograma.rules', () => {
  it('projeta checagens mensais no periodo', () => {
    const from = new Date('2026-06-01T12:00:00');
    const to = new Date('2026-08-31T12:00:00');
    const dates = projectChecagensNoPeriodo({
      proximaChecagemEm: new Date('2026-06-15T00:00:00'),
      frequencia: CronogramaFrequencia.MENSAL,
      from,
      to,
    });

    expect(dates.map((date) => date.toISOString().slice(0, 10))).toEqual([
      '2026-06-15',
      '2026-07-15',
      '2026-08-15',
    ]);
  });

  it('avança frequencia semanal', () => {
    const base = startOfDay(new Date('2026-06-01T00:00:00'));
    const next = addFrequency(base, CronogramaFrequencia.SEMANAL);
    expect(next.toISOString().slice(0, 10)).toBe('2026-06-08');
  });
});
