import { describe, expect, it } from 'vitest';
import { ChamadoStatus } from '@prisma/client';
import {
  buildChamadoCode,
  canTransitionChamadoStatus,
  canUsuarioExecutarChamado,
  CHAMADO_OPEN_STATUSES,
  historicoHasExecucaoCheckin,
  isEvidenciaExecucaoCampo,
  parseExecucaoCheckinMetadata,
  selectableChamadoStatuses,
} from './chamados.rules';

describe('canUsuarioExecutarChamado', () => {
  it('gestor com gerenciar pode executar qualquer chamado', () => {
    expect(
      canUsuarioExecutarChamado(['chamados.gerenciar'], 'u1', { equipeId: 'eq1' }, []),
    ).toBe(true);
  });

  it('operador precisa ser membro da equipe', () => {
    expect(
      canUsuarioExecutarChamado(['chamados.executar'], 'u1', { equipeId: 'eq1' }, ['u2']),
    ).toBe(false);
    expect(
      canUsuarioExecutarChamado(['chamados.executar'], 'u1', { equipeId: 'eq1' }, ['u1', 'u2']),
    ).toBe(true);
  });

  it('operador nao executa chamado sem equipe', () => {
    expect(canUsuarioExecutarChamado(['chamados.executar'], 'u1', { equipeId: null }, ['u1'])).toBe(false);
  });
});

describe('CHAMADO_OPEN_STATUSES', () => {
  it('inclui todos os status operacionais nao encerrados', () => {
    expect(CHAMADO_OPEN_STATUSES).toEqual([
      'ABERTO',
      'EM_TRIAGEM',
      'EM_ATENDIMENTO',
      'EM_EXECUCAO',
      'IMPEDIDO',
    ]);
    expect(CHAMADO_OPEN_STATUSES).not.toContain('CONCLUIDO');
    expect(CHAMADO_OPEN_STATUSES).not.toContain('CANCELADO');
  });
});

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

describe('execucao de campo', () => {
  it('identifica evidencia de execucao em campo', () => {
    expect(isEvidenciaExecucaoCampo({ origem: 'execucao_campo' })).toBe(true);
    expect(isEvidenciaExecucaoCampo({ origem: 'fiscalizacao' })).toBe(false);
    expect(isEvidenciaExecucaoCampo(null)).toBe(false);
  });

  it('detecta check-in de execucao no historico', () => {
    expect(
      historicoHasExecucaoCheckin([
        { metadata: { tipo: 'status_change' } },
        { metadata: { tipo: 'execucao_checkin', latitude: -20.5, longitude: -47.4 } },
      ]),
    ).toBe(true);
    expect(historicoHasExecucaoCheckin([{ metadata: { tipo: 'outro' } }])).toBe(false);
  });

  it('parseia metadata de check-in de execucao', () => {
    const parsed = parseExecucaoCheckinMetadata(
      {
        latitude: -20.53936,
        longitude: -47.40081,
        precisaoMetros: 12,
        distanciaMetros: 8,
        raioMetros: 200,
      },
      '2026-06-10T12:00:00.000Z',
    );

    expect(parsed).toMatchObject({
      latitude: -20.53936,
      longitude: -47.40081,
      precisaoMetros: 12,
      distanciaMetros: 8,
    });
  });
});
