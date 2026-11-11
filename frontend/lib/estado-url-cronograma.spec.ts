import { describe, expect, it } from 'vitest';
import { lerEstadoCronograma } from '@/lib/estado-url-cronograma';

const agora = new Date(2026, 10, 11, 15, 0, 0);

describe('322 L1 · query de Cronograma', () => {
  it('omite o mês corrente e o dia vazio', () => {
    expect(lerEstadoCronograma(new URLSearchParams('mes=2026-11'), agora).canonico.toString()).toBe('');
  });

  it('guarda outro mês, secretaria, próprio e dia', () => {
    const { estado, canonico } = lerEstadoCronograma(
      new URLSearchParams('mes=2026-12&secretaria=sec-1&unidade=u-1&dia=2026-12-03'),
      agora,
    );
    expect(estado.mes).toBe('2026-12');
    expect(estado.dia).toBe('2026-12-03');
    expect(canonico.get('unidade')).toBe('u-1');
  });

  it('ignora mês e dia inválidos', () => {
    const { estado, canonico } = lerEstadoCronograma(new URLSearchParams('mes=13-2026&dia=2026-02-31'), agora);
    expect(estado.mes).toBeNull();
    expect(estado.dia).toBeNull();
    expect(canonico.toString()).toBe('');
  });
});
