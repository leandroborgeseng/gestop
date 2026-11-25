import { ChamadoPrioridade, ChamadoTarefaStatus } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { JwtPayload } from '../auth/jwt';
import { extrairTextoPdf } from '../checklists/pdf-texto';
import { ChamadoTarefasService } from './chamado-tarefas.service';
import { somaGrupos } from './relatorio-tarefas-agregacao';

function gestorSecretariaAtiva(): JwtPayload {
  return {
    sub: 'user-gestor',
    email: 'gestor@test.com',
    nome: 'Gestor',
    perfis: ['Gestor'],
    permissoes: ['dashboard.visualizar'],
    acessoTodasSecretarias: false,
    secretariaId: 'sec-ativa',
    perfilAtivoId: null,
  };
}

function adminGlobal(): JwtPayload {
  return {
    sub: 'user-admin',
    email: 'admin@test.com',
    nome: 'Admin',
    perfis: ['Administrador do Sistema'],
    permissoes: ['dashboard.visualizar'],
    acessoTodasSecretarias: true,
    secretariaId: null,
    perfilAtivoId: null,
  };
}

function chamadoResumo(secretariaId: string, sigla: string) {
  return {
    id: `chamado-${secretariaId}`,
    codigo: `CH-${sigla}`,
    titulo: 'Chamado',
    descricao: 'Descrição',
    status: 'ABERTO',
    prioridade: 'MEDIA',
    enderecoTexto: null,
    prazoEm: null,
    excluidoEm: null,
    latitude: null,
    longitude: null,
    tipoChamado: { id: 'tipo-1', nome: 'Vazamento' },
    unidade: null,
    secretaria: { id: secretariaId, nome: sigla, sigla },
    equipe: null,
  };
}

function tarefaLoaded(overrides: Record<string, unknown> = {}) {
  return {
    id: 'tarefa-1',
    chamadoId: 'chamado-1',
    titulo: 'Análise',
    descricao: null,
    prazo: new Date('2026-09-01T00:00:00.000Z'),
    secretariaId: 'sec-ativa',
    equipeId: 'eq-a',
    responsavelId: null,
    prioridade: ChamadoPrioridade.MEDIA,
    status: ChamadoTarefaStatus.NOVA,
    criadaPorId: 'user-admin',
    createdAt: new Date('2026-10-01T12:00:00.000Z'),
    updatedAt: new Date('2026-10-01T12:00:00.000Z'),
    visualizadaEm: null,
    concluidaEm: null,
    concluidaPorId: null,
    canceladaEm: null,
    justificativa: null,
    conclusaoTexto: null,
    observacao: null,
    secretaria: { id: 'sec-ativa', nome: 'Educação', sigla: 'EDU' },
    equipe: { id: 'eq-a', nome: 'Equipe A', codigo: 'A' },
    responsavel: null,
    criadaPor: { id: 'user-admin', nome: 'Admin' },
    concluidaPor: null,
    anexos: [],
    chamado: chamadoResumo('sec-ativa', 'EDU'),
    ...overrides,
  };
}

describe('ChamadoTarefasService — relatório P3', () => {
  const prisma = {
    chamadoTarefa: { findMany: vi.fn(), count: vi.fn(), groupBy: vi.fn() },
    equipeUsuario: { findMany: vi.fn() },
    secretaria: { findMany: vi.fn() },
    equipe: { findMany: vi.fn() },
    usuario: { findMany: vi.fn() },
    chamado: { findMany: vi.fn() },
  };
  const storage = { persistBuffer: vi.fn() };
  const audit = { record: vi.fn() };
  let service: ChamadoTarefasService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ChamadoTarefasService(prisma as never, storage as never, audit as never);
    prisma.equipeUsuario.findMany.mockResolvedValue([]);
    prisma.chamadoTarefa.count.mockResolvedValue(0);
    prisma.chamadoTarefa.groupBy.mockResolvedValue([]);
    prisma.secretaria.findMany.mockResolvedValue([]);
    prisma.equipe.findMany.mockResolvedValue([]);
    prisma.usuario.findMany.mockResolvedValue([]);
    prisma.chamado.findMany.mockResolvedValue([]);
  });

  function mockFiltroInteiro(total: number) {
    prisma.chamadoTarefa.count.mockResolvedValue(total);
    prisma.chamadoTarefa.findMany.mockImplementation(async (args: { take?: number }) =>
      Array.from({ length: Math.min(args.take ?? 0, 500) }, (_, i) => tarefaLoaded({ id: `t-${i}` })),
    );
    prisma.chamadoTarefa.groupBy.mockImplementation(async (args: { by: string[]; where: unknown }) => {
      const by = args.by.join(',');
      const atrasada = JSON.stringify(args.where).includes('"prazo"');
      if (atrasada) return [];
      if (by === 'status') return [{ status: 'NOVA', _count: { _all: total } }];
      if (by === 'secretariaId,status') return [{ secretariaId: 'sec-ativa', status: 'NOVA', _count: { _all: total } }];
      if (by === 'equipeId,status') return [{ equipeId: 'eq-a', status: 'NOVA', _count: { _all: total } }];
      if (by === 'responsavelId,status') return [{ responsavelId: null, status: 'NOVA', _count: { _all: total } }];
      if (by === 'chamadoId,status') return [{ chamadoId: 'chamado-sec-ativa', status: 'NOVA', _count: { _all: total } }];
      return [];
    });
    prisma.secretaria.findMany.mockResolvedValue([{ id: 'sec-ativa', sigla: 'EDU', nome: 'Educação' }]);
    prisma.equipe.findMany.mockResolvedValue([{ id: 'eq-a', nome: 'Equipe A' }]);
    prisma.chamado.findMany.mockResolvedValue([{ id: 'chamado-sec-ativa', tipoChamado: { nome: 'Vazamento' } }]);
  }

  it('agrupa secretaria e equipe com pendentes e atrasadas, não só o total', async () => {
    prisma.chamadoTarefa.count.mockResolvedValue(4);
    prisma.chamadoTarefa.findMany.mockResolvedValue([tarefaLoaded({ id: 'so-a-primeira-linha' })]);
    prisma.chamadoTarefa.groupBy.mockImplementation(async (args: { by: string[]; where: unknown }) => {
      const by = args.by.join(',');
      const atrasada = JSON.stringify(args.where).includes('"prazo"');
      if (by === 'secretariaId,status' && !atrasada) {
        return [
          { secretariaId: 'sec-ativa', status: 'NOVA', _count: { _all: 1 } },
          { secretariaId: 'sec-ativa', status: 'EM_ANDAMENTO', _count: { _all: 1 } },
          { secretariaId: 'sec-ativa', status: 'CONCLUIDA', _count: { _all: 1 } },
          { secretariaId: 'sec-sau', status: 'VISUALIZADA', _count: { _all: 1 } },
        ];
      }
      if (by === 'secretariaId' && atrasada) return [{ secretariaId: 'sec-ativa', _count: { _all: 1 } }];
      if (by === 'equipeId,status' && !atrasada) {
        return [
          { equipeId: 'eq-a', status: 'NOVA', _count: { _all: 1 } },
          { equipeId: 'eq-a', status: 'EM_ANDAMENTO', _count: { _all: 1 } },
          { equipeId: 'eq-a', status: 'CONCLUIDA', _count: { _all: 1 } },
          { equipeId: 'eq-b', status: 'VISUALIZADA', _count: { _all: 1 } },
        ];
      }
      if (by === 'equipeId' && atrasada) return [{ equipeId: 'eq-a', _count: { _all: 1 } }];
      return [];
    });
    prisma.secretaria.findMany.mockResolvedValue([
      { id: 'sec-ativa', sigla: 'EDU', nome: 'Educação' },
      { id: 'sec-sau', sigla: 'SAU', nome: 'Saúde' },
    ]);
    prisma.equipe.findMany.mockResolvedValue([
      { id: 'eq-a', nome: 'Equipe A' },
      { id: 'eq-b', nome: 'Equipe B' },
    ]);

    const resultado = await service.relatorio({}, adminGlobal());
    expect(resultado.items).toHaveLength(1);

    expect(resultado.indicadores.porSecretaria).toEqual([
      { nome: 'EDU', total: 3, pendentes: 2, atrasadas: 1 },
      { nome: 'SAU', total: 1, pendentes: 1, atrasadas: 0 },
    ]);
    expect(resultado.indicadores.porEquipe).toEqual([
      { nome: 'Equipe A', total: 3, pendentes: 2, atrasadas: 1 },
      { nome: 'Equipe B', total: 1, pendentes: 1, atrasadas: 0 },
    ]);
  });

  it('o relatório restringe pela Secretaria ativa da sessão', async () => {
    prisma.chamadoTarefa.findMany.mockResolvedValue([]);

    await service.relatorio({ from: '2026-10-01', to: '2026-10-06' }, gestorSecretariaAtiva());

    expect(prisma.chamadoTarefa.findMany).toHaveBeenCalledTimes(1);
    const where = prisma.chamadoTarefa.findMany.mock.calls[0][0].where;
    const whereGrupo = prisma.chamadoTarefa.groupBy.mock.calls.find((call) => call[0].by.join(',') === 'status')?.[0].where;
    expect(whereGrupo).toEqual(where);
    expect(where).toEqual({
      AND: expect.arrayContaining([
        { chamado: { excluidoEm: null } },
        { secretariaId: { in: ['sec-ativa'] } },
        {
          createdAt: {
            gte: new Date('2026-10-01'),
            lte: new Date('2026-10-06T23:59:59.999'),
          },
        },
      ]),
    });
    expect(JSON.stringify(where)).not.toContain('prazoFrom');
  });

  it('UX-01: capa formal exporta no máximo 500 e informa o corte quando o filtro passa do teto', async () => {
    prisma.chamadoTarefa.count.mockResolvedValue(600);
    prisma.chamadoTarefa.findMany.mockResolvedValue([tarefaLoaded()]);

    const csv = await service.exportarCsv({ capa: 'formal' }, adminGlobal());

    expect(prisma.chamadoTarefa.findMany.mock.calls[0][0].take).toBe(500);
    expect(csv).toContain('Mostrando 1 de 600 tarefas');
    expect(csv.split('\n').filter((linha) => linha.startsWith('CH-')).length).toBe(1);
  });

  it('UX-02: Prazo até fecha o dia em America/Sao_Paulo, sem mexer no createdAt', async () => {
    prisma.chamadoTarefa.findMany.mockResolvedValue([]);
    await service.relatorio({ prazoTo: '2026-10-05', from: '2026-10-01', to: '2026-10-06' }, adminGlobal());
    const where = prisma.chamadoTarefa.findMany.mock.calls.at(-1)?.[0].where;
    expect(where).toEqual({
      AND: expect.arrayContaining([
        {
          prazo: { lte: new Date('2026-10-06T02:59:59.999Z') },
        },
        {
          createdAt: {
            gte: new Date('2026-10-01'),
            lte: new Date('2026-10-06T23:59:59.999'),
          },
        },
      ]),
    });
  });

  it('UX-01: com 500 ou menos o CSV não traz aviso de corte', async () => {
    prisma.chamadoTarefa.count.mockResolvedValue(1);
    prisma.chamadoTarefa.findMany.mockResolvedValue([tarefaLoaded()]);

    const csv = await service.exportarCsv({ capa: 'simples' }, adminGlobal());

    expect(csv).not.toContain('Mostrando');
    expect(prisma.chamadoTarefa.findMany.mock.calls[0][0].take).toBe(500);
  });

  it('R-1: com 604 tarefas os cartões e os grupos somam o filtro, e o PDF formal repete esses totais', async () => {
    mockFiltroInteiro(604);
    const relatorio = await service.relatorio({}, adminGlobal());
    expect(relatorio.total).toBe(604);
    expect(relatorio.items).toHaveLength(500);
    expect(relatorio.indicadores.abertas).toBe(604);
    expect(somaGrupos(relatorio.indicadores.porSecretaria, 'pendentes')).toBe(604);
    expect(somaGrupos(relatorio.indicadores.porSecretaria, 'total')).toBe(604);
    expect(somaGrupos(relatorio.indicadores.porEquipe, 'total')).toBe(604);
    expect(somaGrupos(relatorio.indicadores.porResponsavel, 'total')).toBe(604);
    expect(somaGrupos(relatorio.indicadores.porTipoChamado, 'total')).toBe(604);
    const whereLista = prisma.chamadoTarefa.count.mock.calls[0][0].where;
    const whereGrupo = prisma.chamadoTarefa.groupBy.mock.calls.find((call) => call[0].by.join(',') === 'status')?.[0].where;
    expect(whereGrupo).toEqual(whereLista);

    const pdf = await service.exportarPdf({ capa: 'formal' }, adminGlobal());
    const texto = await extrairTextoPdf(pdf);
    expect(texto).toContain('Mostrando 500 de 604 tarefas');
    expect(texto).toContain('Total de registros: 500');
    expect(texto).toContain('Abertas: 604');
    expect(texto).toContain('Pendentes por secretaria: EDU 604');

    const simples = await extrairTextoPdf(await service.exportarPdf({ capa: 'simples' }, adminGlobal()));
    expect(simples).toContain('Mostrando 500 de 604 tarefas');
    expect(simples).not.toContain('Pendentes por secretaria');
  });

  it('R-1: com exatamente 500 linhas não há aviso nem corte, e os cartões somam 500', async () => {
    mockFiltroInteiro(500);
    const relatorio = await service.relatorio({}, adminGlobal());
    expect(relatorio.items).toHaveLength(500);
    expect(somaGrupos(relatorio.indicadores.porSecretaria, 'pendentes')).toBe(500);
    expect(somaGrupos(relatorio.indicadores.porSecretaria, 'total')).toBe(500);
    const csv = await service.exportarCsv({}, adminGlobal());
    expect(csv).not.toContain('Mostrando');
    expect(csv.split('\n').filter((linha) => linha.startsWith('CH-'))).toHaveLength(500);
    const texto = await extrairTextoPdf(await service.exportarPdf({ capa: 'formal' }, adminGlobal()));
    expect(texto).not.toContain('Mostrando');
    expect(texto).toContain('Total de registros: 500');
    expect(texto).toContain('Abertas: 500');
    expect(texto).toContain('Pendentes por secretaria: EDU 500');
  });

  it('R-1: com 501 linhas avisa "Mostrando 500 de 501", corta o export e os cartões somam 501', async () => {
    mockFiltroInteiro(501);
    const relatorio = await service.relatorio({}, adminGlobal());
    expect(relatorio.total).toBe(501);
    expect(relatorio.items).toHaveLength(500);
    expect(somaGrupos(relatorio.indicadores.porSecretaria, 'pendentes')).toBe(501);
    expect(relatorio.indicadores.abertas).toBe(501);
    const csv = await service.exportarCsv({ capa: 'formal' }, adminGlobal());
    expect(csv).toContain('Mostrando 500 de 501 tarefas');
    expect(csv.split('\n').filter((linha) => linha.startsWith('CH-'))).toHaveLength(500);
    expect(prisma.chamadoTarefa.findMany.mock.calls[0][0].take).toBe(500);
    const texto = await extrairTextoPdf(await service.exportarPdf({ capa: 'formal' }, adminGlobal()));
    expect(texto).toContain('Mostrando 500 de 501 tarefas');
    expect(texto).toContain('Total de registros: 500');
    expect(texto).toContain('Abertas: 501');
    expect(texto).toContain('Pendentes por secretaria: EDU 501');
  });
});
