import { describe, expect, it } from 'vitest';
import { ChamadoStatus } from '@prisma/client';
import { buildChamadoCode, canTransitionChamadoStatus, selectableChamadoStatuses } from './chamados.rules';

describe('buildChamadoCode', () => {
  it('formata codigo com ano e sequencia', () => {
    const year = new Date().getFullYear();
    expect(buildChamadoCode(1)).toBe(`CH-${year}-000001`);
    expect(buildChamadoCode(42)).toBe(`CH-${year}-000042`);
  });
});

describe('canTransitionChamadoStatus', () => {
  it('permite alterar para qualquer status diferente do atual', () => {
    expect(canTransitionChamadoStatus('EM_ATENDIMENTO', 'EM_TRIAGEM')).toBe(true);
    expect(canTransitionChamadoStatus('CONCLUIDO', 'EM_ATENDIMENTO')).toBe(true);
    expect(canTransitionChamadoStatus('ABERTO', 'ABERTO')).toBe(false);
  });

  it('lista todos os demais status como opcoes', () => {
    expect(selectableChamadoStatuses(ChamadoStatus.ABERTO)).toHaveLength(6);
    expect(selectableChamadoStatuses(ChamadoStatus.ABERTO)).not.toContain('ABERTO');
  });
});
