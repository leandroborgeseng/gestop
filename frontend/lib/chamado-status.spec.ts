import { describe, expect, it } from 'vitest';
import { buildChamadoTimelineFromHistorico } from './chamado-status';

describe('buildChamadoTimelineFromHistorico atribuição', () => {
  it('exibe responsável na linha do tempo ao atualizar atribuição', () => {
    const steps = buildChamadoTimelineFromHistorico(
      [
        {
          id: 'hist-1',
          statusAnterior: 'EM_TRIAGEM',
          statusNovo: 'EM_TRIAGEM',
          motivo: 'Atribuição de equipe/responsável atualizada.',
          createdAt: '2026-06-15T20:24:57.000Z',
          alteradoPor: { nome: 'Gestor CCO' },
          metadata: {
            tipo: 'atribuicao_update',
            alteracoes: [
              { campo: 'equipe', label: 'Equipe', de: 'Sem equipe', para: 'Zeladoria C-1' },
              { campo: 'responsavel', label: 'Responsável', de: 'Sem responsável', para: 'Carlos Mendes' },
            ],
          },
        },
      ],
      'EM_TRIAGEM',
      '2026-06-15T17:00:00.000Z',
    );

    expect(steps[0]?.title).toBe('Atribuição atualizada');
    expect(steps[0]?.sub).toContain('Carlos Mendes');
    expect(steps[0]?.expand?.alteracoes).toHaveLength(2);
  });

  it('reconhece motivo padrão de atribuição de equipe', () => {
    const steps = buildChamadoTimelineFromHistorico(
      [
        {
          id: 'hist-2',
          statusAnterior: 'EM_TRIAGEM',
          statusNovo: 'EM_TRIAGEM',
          motivo: 'Atribuição de equipe atualizada.',
          createdAt: '2026-06-15T20:30:00.000Z',
          alteradoPor: { nome: 'Gestor CCO' },
          metadata: {
            tipo: 'atribuicao_update',
            alteracoes: [
              { campo: 'responsavel', label: 'Responsável', de: 'Sem responsável', para: 'Ana Paula' },
            ],
          },
        },
      ],
      'EM_TRIAGEM',
      '2026-06-15T17:00:00.000Z',
    );

    expect(steps[0]?.sub).toContain('Ana Paula');
  });
});
