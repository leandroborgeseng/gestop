import { CronogramaFrequencia } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { addFrequency, projectChecagensNoPeriodo, proximaDataAoReativar, startOfDay, toDateKey } from './cronograma.rules';

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

describe('308 · proximaDataAoReativar', () => {
  const hoje = startOfDay(new Date(2026, 10, 4));
  it('avança no passo da frequência até hoje ou depois, sem gerar datas passadas', () => {
    expect(toDateKey(proximaDataAoReativar(new Date(2026, 9, 1), CronogramaFrequencia.SEMANAL, hoje))).toBe('2026-11-05');
    expect(toDateKey(proximaDataAoReativar(new Date(2026, 6, 4), CronogramaFrequencia.MENSAL, hoje))).toBe('2026-11-04');
    expect(toDateKey(proximaDataAoReativar(new Date(2025, 0, 10), CronogramaFrequencia.ANUAL, hoje))).toBe('2027-01-10');
  });
  it('data futura ou hoje fica igual', () => {
    expect(toDateKey(proximaDataAoReativar(new Date(2026, 11, 1), CronogramaFrequencia.MENSAL, hoje))).toBe('2026-12-01');
    expect(toDateKey(proximaDataAoReativar(hoje, CronogramaFrequencia.SEMANAL, hoje))).toBe('2026-11-04');
  });
});
