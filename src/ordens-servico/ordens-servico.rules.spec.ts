import { Severidade } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import {
  assertValidOrderTransition,
  buildServiceOrderCode,
  buildServiceOrderTitle,
  priorityFromSeverity,
  shouldGenerateServiceOrder,
} from './ordens-servico.rules';

describe('geração automática de ordens de serviço', () => {
  it('gera OS apenas quando a nao conformidade ainda nao possui ordem vinculada', () => {
    expect(shouldGenerateServiceOrder({ naoConformidadeId: 'nc-1' })).toBe(true);
    expect(shouldGenerateServiceOrder({ naoConformidadeId: 'nc-1', ordemServicoId: 'os-1' })).toBe(false);
  });

  it('define prioridade a partir da severidade', () => {
    expect(priorityFromSeverity(Severidade.CRITICA)).toBe('URGENTE');
    expect(priorityFromSeverity(Severidade.ALTA)).toBe('ALTA');
    expect(priorityFromSeverity(Severidade.MEDIA)).toBe('MEDIA');
    expect(priorityFromSeverity(Severidade.BAIXA)).toBe('BAIXA');
  });

  it('monta código e título auditáveis', () => {
    expect(buildServiceOrderCode(12, new Date('2026-05-18T12:00:00.000Z'))).toBe('OS-2026-000012');
    expect(buildServiceOrderTitle('Iluminação das áreas comuns')).toBe(
      'Corrigir não conformidade: Iluminação das áreas comuns',
    );
  });

  it('controla transições válidas de status', () => {
    expect(() => assertValidOrderTransition('ABERTA', 'ATRIBUIDA')).not.toThrow();
    expect(() => assertValidOrderTransition('ABERTA', 'CONCLUIDA')).toThrow('Transição inválida');
    expect(() => assertValidOrderTransition('CONCLUIDA', 'EM_EXECUCAO')).toThrow('Transição inválida');
  });
});
