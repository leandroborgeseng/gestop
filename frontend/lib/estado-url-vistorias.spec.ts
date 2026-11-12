import { describe, expect, it } from 'vitest';
import { lerEstadoVistorias } from '@/lib/estado-url-vistorias';

const ID = '11111111-1111-4111-8111-111111111111';

describe('322 L1 · query de Vistorias', () => {
  it('sem parâmetros é concluídas, sem id', () => {
    const { estado, canonico } = lerEstadoVistorias(new URLSearchParams());
    expect(estado.status).toBe('CONCLUIDA');
    expect(estado.id).toBeNull();
    expect(canonico.toString()).toBe('');
  });

  it('grava todas, tipo, avulsa, período e id', () => {
    const { estado, canonico } = lerEstadoVistorias(
      new URLSearchParams(`status=todas&tipoUnidade=escola&avulsa=sim&de=2026-11-01&ate=2026-11-11&id=${ID}`),
    );
    expect(estado.status).toBe('');
    expect(estado.tipo).toBe('ESCOLA');
    expect(estado.avulsa).toBe('true');
    expect(estado.id).toBe(ID);
    expect(canonico.get('status')).toBe('todas');
    expect(canonico.get('avulsa')).toBe('sim');
  });

  it('ignora status inválido e mantém id fora do UUID', () => {
    const { estado, canonico } = lerEstadoVistorias(new URLSearchParams('status=xyz&id=nao-e-uuid&avulsa=talvez'));
    expect(estado.status).toBe('CONCLUIDA');
    expect(estado.id).toBe('nao-e-uuid');
    expect(canonico.get('id')).toBe('nao-e-uuid');
    expect(canonico.get('status')).toBeNull();
    expect(canonico.get('avulsa')).toBeNull();
  });
});
