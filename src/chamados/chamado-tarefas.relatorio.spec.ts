import { ChamadoPrioridade, ChamadoTarefaStatus } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { JwtPayload } from '../auth/jwt';
import { ChamadoTarefasService } from './chamado-tarefas.service';

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
    chamadoTarefa: { findMany: vi.fn() },
    equipeUsuario: { findMany: vi.fn() },
  };
  const storage = { persistBuffer: vi.fn() };
  const audit = { record: vi.fn() };
  let service: ChamadoTarefasService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ChamadoTarefasService(prisma as never, storage as never, audit as never);
    prisma.equipeUsuario.findMany.mockResolvedValue([]);
  });

  it('agrupa secretaria e equipe com pendentes e atrasadas, não só o total', async () => {
    prisma.chamadoTarefa.findMany.mockResolvedValue([
      tarefaLoaded({
        id: 't-edu-atrasada',
        status: ChamadoTarefaStatus.NOVA,
        prazo: new Date('2020-09-01T00:00:00.000Z'),
      }),
      tarefaLoaded({
        id: 't-edu-ok',
        status: ChamadoTarefaStatus.EM_ANDAMENTO,
        prazo: new Date('2099-12-01T00:00:00.000Z'),
      }),
      tarefaLoaded({
        id: 't-edu-concluida',
        status: ChamadoTarefaStatus.CONCLUIDA,
        prazo: new Date('2020-09-01T00:00:00.000Z'),
        concluidaEm: new Date('2020-09-02T00:00:00.000Z'),
      }),
      tarefaLoaded({
        id: 't-sau',
        secretariaId: 'sec-sau',
        secretaria: { id: 'sec-sau', nome: 'Saúde', sigla: 'SAU' },
        equipe: { id: 'eq-b', nome: 'Equipe B', codigo: 'B' },
        status: ChamadoTarefaStatus.VISUALIZADA,
        prazo: new Date('2099-12-01T00:00:00.000Z'),
        chamado: chamadoResumo('sec-sau', 'SAU'),
      }),
    ]);

    const resultado = await service.relatorio({}, adminGlobal());

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
});
