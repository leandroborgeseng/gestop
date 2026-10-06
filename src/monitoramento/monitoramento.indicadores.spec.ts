import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MonitoramentoService } from './monitoramento.service';

vi.mock('../relatorios/relatorios.execucao-participantes', () => ({
  loadExecucaoParticipantes: vi.fn(async () => new Map()),
}));

describe('MonitoramentoService — indicadores de chamados (254)', () => {
  const prisma = {
    unidadePublica: { count: vi.fn() },
    fiscalizacao: { count: vi.fn(), findMany: vi.fn() },
    naoConformidade: { count: vi.fn() },
    chamado: { count: vi.fn(), findMany: vi.fn(), groupBy: vi.fn() },
    chamadoTarefa: { count: vi.fn(), findMany: vi.fn() },
    offlineSyncEvent: { count: vi.fn() },
    secretaria: { findMany: vi.fn() },
    tipoChamado: { findMany: vi.fn() },
  };
  let service: MonitoramentoService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new MonitoramentoService(prisma as never);
    prisma.unidadePublica.count.mockResolvedValue(0);
    prisma.fiscalizacao.count.mockResolvedValue(0);
    prisma.fiscalizacao.findMany.mockResolvedValue([]);
    prisma.naoConformidade.count.mockResolvedValue(0);
    prisma.chamado.count.mockResolvedValue(2);
    prisma.chamado.findMany.mockResolvedValue([]);
    prisma.chamado.groupBy.mockResolvedValue([]);
    prisma.chamadoTarefa.count.mockResolvedValue(99);
    prisma.chamadoTarefa.findMany.mockResolvedValue([{ id: 'tarefa-1' }]);
    prisma.offlineSyncEvent.count.mockResolvedValue(0);
    prisma.secretaria.findMany.mockResolvedValue([
      {
        id: 'sec-1',
        sigla: 'EDU',
        nome: 'Educação',
        _count: { chamados: 2, fiscalizacoes: 0 },
      },
    ]);
    prisma.tipoChamado.findMany.mockResolvedValue([]);
  });

  it('tarefa não entra nos indicadores de chamados', async () => {
    const dashboard = await service.getDashboard({});

    expect(dashboard.indicadores.chamados.abertos).toBe(2);
    expect(dashboard.indicadores.chamados.emAtendimento).toBe(2);
    expect(dashboard.indicadores.chamados.emExecucao).toBe(2);
    expect(dashboard.indicadores.chamados.impedidos).toBe(2);
    expect(dashboard.indicadores.chamados.concluidos).toBe(2);
    expect(dashboard.pendenciasPorSecretaria).toEqual([
      { id: 'sec-1', sigla: 'EDU', nome: 'Educação', chamadosPendentes: 2, fiscalizacoes: 0 },
    ]);
    expect(prisma.chamado.count).toHaveBeenCalled();
    expect(prisma.chamadoTarefa.count).not.toHaveBeenCalled();
    expect(prisma.chamadoTarefa.findMany).not.toHaveBeenCalled();
  });
});
