import { describe, expect, it } from 'vitest';
import { buildOrdensServicoLotePdf } from './chamados-os-pdf';

describe('buildOrdensServicoLotePdf', () => {
  it('gera PDF com seção de funcionários e assinatura', async () => {
    const buffer = await buildOrdensServicoLotePdf(
      [
        {
          codigo: 'CH-1',
          tipo: 'Manutenção',
          prioridade: 'MEDIA',
          descricao: 'Troca de lâmpada',
          endereco: 'Rua A, 100',
          equipe: 'Zeladoria A',
          funcionarios: [
            { nome: 'João Silva', cargo: 'Eletricista' },
            { nome: 'Maria Souza', cargo: null },
          ],
          prazoSla: '2026-07-20T12:00:00.000Z',
          abertoEm: '2026-07-15T08:00:00.000Z',
          programadoEm: '2026-07-16T08:00:00.000Z',
        },
        {
          codigo: 'CH-2',
          tipo: 'Limpeza',
          prioridade: 'BAIXA',
          descricao: 'Sem equipe',
          endereco: 'Rua B',
          equipe: null,
          funcionarios: [],
        },
      ],
      { titulo: 'Ordens de Serviço — teste' },
    );

    expect(buffer.length).toBeGreaterThan(500);
    expect(buffer.subarray(0, 4).toString('utf8')).toBe('%PDF');
  });
});
