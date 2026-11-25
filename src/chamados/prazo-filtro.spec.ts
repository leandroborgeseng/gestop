import { describe, expect, it } from 'vitest';
import { instantePrazoFiltro, prazoNoIntervalo } from './prazo-filtro';

describe('UX-02 — prazo inclusivo em America/Sao_Paulo', () => {
  it('Prazo até 05/10 inclui 05/10 23:00 BRT e exclui 06/10 00:30 BRT', () => {
    const ate = instantePrazoFiltro('2026-10-05', 'ate');
    expect(ate?.toISOString()).toBe('2026-10-06T02:59:59.999Z');
    expect(prazoNoIntervalo(new Date('2026-10-06T02:00:00.000Z'), undefined, '2026-10-05')).toBe(true);
    expect(prazoNoIntervalo(new Date('2026-10-06T03:30:00.000Z'), undefined, '2026-10-05')).toBe(false);
  });

  it('Prazo de 05/10 começa à meia-noite BRT', () => {
    expect(instantePrazoFiltro('2026-10-05', 'de')?.toISOString()).toBe('2026-10-05T03:00:00.000Z');
    expect(prazoNoIntervalo(new Date('2026-10-05T02:30:00.000Z'), '2026-10-05', undefined)).toBe(false);
    expect(prazoNoIntervalo(new Date('2026-10-05T03:00:00.000Z'), '2026-10-05', '2026-10-05')).toBe(true);
  });

  it('instante ISO absoluto não é reinterpretado como dia civil', () => {
    const iso = '2026-10-05T17:00:00.000Z';
    expect(instantePrazoFiltro(iso, 'ate')?.toISOString()).toBe(iso);
  });
});
