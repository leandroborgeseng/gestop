import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ChamadoPrioridade, ChamadoTarefaStatus } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { JwtPayload } from '../auth/jwt';
import { ChamadoTarefasService } from './chamado-tarefas.service';

const JPEG_DATA_URL = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBD';

function adminUser(): JwtPayload {
  return {
    sub: 'user-admin',
    email: 'admin@test.com',
    nome: 'Admin',
    perfis: ['Administrador do Sistema'],
    permissoes: [],
    acessoTodasSecretarias: true,
    secretariaId: null,
    perfilAtivoId: null,
  };
}

function userSemPermissao(): JwtPayload {
  return {
    sub: 'user-sem',
    email: 'sem@test.com',
    nome: 'Sem permissão',
    perfis: [],
    permissoes: [],
    acessoTodasSecretarias: true,
    secretariaId: null,
    perfilAtivoId: null,
  };
}

function userSoVisualizar(): JwtPayload {
  return {
    sub: 'user-ver',
    email: 'ver@test.com',
    nome: 'Só visualizar',
    perfis: [],
    permissoes: ['matriz.chamados.tarefas.visualizar'],
    acessoTodasSecretarias: true,
    secretariaId: null,
    perfilAtivoId: null,
  };
}

function userResponsavelTarefa(): JwtPayload {
  return {
    sub: 'user-resp',
    email: 'resp@test.com',
    nome: 'Responsável da tarefa',
    perfis: [],
    permissoes: [],
    acessoTodasSecretarias: false,
    secretariaId: 'sec-outra',
    perfilAtivoId: null,
  };
}

function chamadoResumo() {
  return {
    id: 'chamado-1',
    codigo: 'CH-001',
    titulo: 'Chamado teste',
    descricao: 'Descrição',
    status: 'ABERTO',
    prioridade: 'MEDIA',
    enderecoTexto: 'Rua Teste',
    prazoEm: null,
    excluidoEm: null,
    latitude: null,
    longitude: null,
    tipoChamado: null,
    unidade: null,
    secretaria: { id: 'sec-1', nome: 'Secretaria Teste', sigla: 'ST' },
    equipe: null,
  };
}

function tarefaLoaded(overrides: Record<string, unknown> = {}) {
  return {
    id: 'tarefa-1',
    chamadoId: 'chamado-1',
    titulo: 'Análise técnica',
    descricao: 'Realizar análise',
    prazo: new Date('2026-10-10T00:00:00.000Z'),
    secretariaId: 'sec-1',
    equipeId: null,
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
    secretaria: { id: 'sec-1', nome: 'Secretaria Teste', sigla: 'ST' },
    equipe: null,
    responsavel: null,
    criadaPor: { id: 'user-admin', nome: 'Admin' },
    concluidaPor: null,
    anexos: [],
    chamado: chamadoResumo(),
    ...overrides,
  };
}

describe('ChamadoTarefasService', () => {
  const prisma = {
    chamado: { findFirst: vi.fn() },
    chamadoTarefa: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    chamadoTarefaAnexo: { create: vi.fn() },
    historicoStatus: { create: vi.fn(), findMany: vi.fn() },
    evidencia: { findMany: vi.fn() },
    secretaria: { findFirst: vi.fn(), findMany: vi.fn(), findUnique: vi.fn() },
    equipe: { findFirst: vi.fn(), findMany: vi.fn() },
    equipeUsuario: { findMany: vi.fn(), findUnique: vi.fn() },
    usuario: { findFirst: vi.fn() },
    perfil: { findUnique: vi.fn() },
  };
  const storage = { persistBuffer: vi.fn() };
  const audit = { record: vi.fn() };
  let service: ChamadoTarefasService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ChamadoTarefasService(prisma as never, storage as never, audit as never);
    prisma.chamado.findFirst.mockResolvedValue({ id: 'chamado-1', codigo: 'CH-001', status: 'ABERTO' });
    prisma.secretaria.findFirst.mockResolvedValue({ id: 'sec-1' });
    prisma.equipeUsuario.findMany.mockResolvedValue([]);
    prisma.perfil.findUnique.mockResolvedValue(null);
    prisma.secretaria.findUnique.mockResolvedValue(null);
    prisma.historicoStatus.create.mockResolvedValue({ id: 'hist-1' });
    prisma.historicoStatus.findMany.mockResolvedValue([]);
    prisma.evidencia.findMany.mockResolvedValue([]);
    prisma.chamadoTarefa.delete.mockResolvedValue({ id: 'tarefa-1' });
    audit.record.mockResolvedValue(undefined);
  });

  describe('create', () => {
    it('cria tarefa sem anexos e não grava arquivo', async () => {
      const criada = tarefaLoaded();
      prisma.chamadoTarefa.create.mockResolvedValue(criada);

      const resultado = await service.create(
        {
          chamadoId: 'chamado-1',
          titulo: 'Análise técnica',
          descricao: 'Realizar análise',
          secretariaId: 'sec-1',
        },
        adminUser(),
      );

      expect(resultado.titulo).toBe('Análise técnica');
      expect(resultado.createdAt).toBe('2026-10-01T12:00:00.000Z');
      expect(resultado.anexos).toEqual([]);
      expect(storage.persistBuffer).not.toHaveBeenCalled();
      expect(prisma.chamadoTarefaAnexo.create).not.toHaveBeenCalled();
      expect(prisma.historicoStatus.create).toHaveBeenCalled();
    });

    it('cria tarefa com anexo opcional reusando o storage existente', async () => {
      const criada = tarefaLoaded();
      const comAnexo = tarefaLoaded({
        anexos: [
          {
            id: 'anexo-1',
            nome: 'foto.jpg',
            url: 'https://storage.test/tarefas/foto.jpg',
            mimeType: 'image/jpeg',
            tamanhoBytes: 24,
            createdAt: new Date('2026-10-01T12:00:00.000Z'),
          },
        ],
      });
      prisma.chamadoTarefa.create.mockResolvedValue(criada);
      storage.persistBuffer.mockResolvedValue({
        url: 'https://storage.test/tarefas/foto.jpg',
        storageKey: 'tarefas/key-1',
        mimeType: 'image/jpeg',
        tamanhoBytes: 24,
      });
      prisma.chamadoTarefaAnexo.create.mockResolvedValue({ id: 'anexo-1' });
      prisma.chamadoTarefa.findFirst.mockResolvedValue(comAnexo);

      const resultado = await service.create(
        {
          chamadoId: 'chamado-1',
          titulo: 'Análise técnica',
          secretariaId: 'sec-1',
          anexos: [{ dataUrl: JPEG_DATA_URL, nome: 'foto.jpg' }],
        },
        adminUser(),
      );

      expect(storage.persistBuffer).toHaveBeenCalledTimes(1);
      expect(storage.persistBuffer.mock.calls[0]?.[2]).toBe('tarefas');
      expect(prisma.chamadoTarefaAnexo.create).toHaveBeenCalledTimes(1);
      expect(prisma.chamadoTarefaAnexo.create.mock.calls[0]?.[0]?.data).toMatchObject({
        tarefaId: 'tarefa-1',
        nome: 'foto.jpg',
        criadoPorId: 'user-admin',
      });
      expect(resultado.anexos).toHaveLength(1);
      expect(resultado.anexos[0]?.nome).toBe('foto.jpg');
    });

    it('rejeita criação (com ou sem anexo) sem permissão de inserir', async () => {
      await expect(
        service.create({ chamadoId: 'chamado-1', titulo: 'Teste sem anexo', secretariaId: 'sec-1' }, userSemPermissao()),
      ).rejects.toThrow(ForbiddenException);

      await expect(
        service.create(
          {
            chamadoId: 'chamado-1',
            titulo: 'Teste com anexo',
            secretariaId: 'sec-1',
            anexos: [{ dataUrl: JPEG_DATA_URL, nome: 'foto.jpg' }],
          },
          userSoVisualizar(),
        ),
      ).rejects.toThrow(ForbiddenException);

      expect(prisma.chamadoTarefa.create).not.toHaveBeenCalled();
      expect(storage.persistBuffer).not.toHaveBeenCalled();
    });

    it('rejeita anexo inválido antes de criar a tarefa', async () => {
      await expect(
        service.create(
          {
            chamadoId: 'chamado-1',
            titulo: 'Análise técnica',
            secretariaId: 'sec-1',
            anexos: [{ dataUrl: 'isto-nao-e-um-data-url-valido', nome: 'x.bin' }],
          },
          adminUser(),
        ),
      ).rejects.toBeInstanceOf(BadRequestException);

      await expect(
        service.create(
          {
            chamadoId: 'chamado-1',
            titulo: 'Análise técnica',
            secretariaId: 'sec-1',
            anexos: [{ dataUrl: 'data:text/plain;base64,aGVsbG8gd29ybGQ=', nome: 'nota.txt' }],
          },
          adminUser(),
        ),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(prisma.chamadoTarefa.create).not.toHaveBeenCalled();
      expect(storage.persistBuffer).not.toHaveBeenCalled();
      expect(prisma.chamadoTarefa.delete).not.toHaveBeenCalled();
    });

    it('apaga a tarefa se o storage falhar depois do create', async () => {
      prisma.chamadoTarefa.create.mockResolvedValue(tarefaLoaded());
      storage.persistBuffer.mockRejectedValue(new Error('storage indisponível'));

      await expect(
        service.create(
          {
            chamadoId: 'chamado-1',
            titulo: 'Análise técnica',
            secretariaId: 'sec-1',
            anexos: [{ dataUrl: JPEG_DATA_URL, nome: 'foto.jpg' }],
          },
          adminUser(),
        ),
      ).rejects.toThrow('storage indisponível');

      expect(prisma.chamadoTarefa.create).toHaveBeenCalledTimes(1);
      expect(prisma.chamadoTarefa.delete).toHaveBeenCalledWith({ where: { id: 'tarefa-1' } });
    });
  });

  describe('listByChamado', () => {
    it('conta pendentes só entre não encerradas e devolve abertas e encerradas juntas', async () => {
      prisma.chamadoTarefa.findMany.mockResolvedValue([
        tarefaLoaded({ id: 't-nova', status: ChamadoTarefaStatus.NOVA, titulo: 'Nova' }),
        tarefaLoaded({ id: 't-andamento', status: ChamadoTarefaStatus.EM_ANDAMENTO, titulo: 'Andamento' }),
        tarefaLoaded({ id: 't-impedida', status: ChamadoTarefaStatus.IMPEDIDA, titulo: 'Impedida antiga' }),
        tarefaLoaded({
          id: 't-concluida',
          status: ChamadoTarefaStatus.CONCLUIDA,
          titulo: 'Concluída',
          concluidaEm: new Date('2026-09-25T00:00:00.000Z'),
        }),
        tarefaLoaded({
          id: 't-cancelada',
          status: ChamadoTarefaStatus.CANCELADA,
          titulo: 'Cancelada',
          canceladaEm: new Date('2026-09-16T00:00:00.000Z'),
        }),
      ]);

      const resultado = await service.listByChamado('chamado-1', adminUser());

      expect(resultado.total).toBe(5);
      expect(resultado.pendentes).toBe(2);
      expect(resultado.items.map((item) => item.status)).toEqual([
        'NOVA',
        'EM_ANDAMENTO',
        'IMPEDIDA',
        'CONCLUIDA',
        'CANCELADA',
      ]);
      expect(resultado.items.every((item) => typeof item.createdAt === 'string')).toBe(true);
    });
  });
});

function acoesTrilhaTarefa(prismaMock: { historicoStatus: { create: { mock: { calls: unknown[] } } } }) {
  return prismaMock.historicoStatus.create.mock.calls
    .map((call) => (call as [{ data?: { entidadeTipo?: string; metadata?: { acao?: string } } }])[0]?.data)
    .filter((data) => data?.entidadeTipo === 'ChamadoTarefa')
    .map((data) => data?.metadata?.acao);
}

describe('ChamadoTarefasService — leitura do chamado via tarefa', () => {
  const prisma = {
    chamado: { findFirst: vi.fn() },
    chamadoTarefa: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    chamadoTarefaAnexo: { create: vi.fn() },
    historicoStatus: { create: vi.fn(), findMany: vi.fn() },
    evidencia: { findMany: vi.fn() },
    secretaria: { findFirst: vi.fn(), findMany: vi.fn(), findUnique: vi.fn() },
    equipe: { findFirst: vi.fn(), findMany: vi.fn() },
    equipeUsuario: { findMany: vi.fn(), findUnique: vi.fn() },
    usuario: { findFirst: vi.fn() },
    perfil: { findUnique: vi.fn() },
  };
  const storage = { persistBuffer: vi.fn() };
  const audit = { record: vi.fn() };
  let service: ChamadoTarefasService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ChamadoTarefasService(prisma as never, storage as never, audit as never);
    prisma.equipeUsuario.findMany.mockResolvedValue([]);
    prisma.equipeUsuario.findUnique.mockResolvedValue(null);
    prisma.perfil.findUnique.mockResolvedValue(null);
    prisma.secretaria.findUnique.mockResolvedValue(null);
    prisma.historicoStatus.create.mockResolvedValue({ id: 'hist-1' });
    prisma.historicoStatus.findMany.mockResolvedValue([]);
    audit.record.mockResolvedValue(undefined);
  });

  function mockTarefaDoResponsavel() {
    prisma.chamadoTarefa.findFirst.mockResolvedValue(
      tarefaLoaded({
        responsavelId: 'user-resp',
        responsavel: { id: 'user-resp', nome: 'Responsável da tarefa', email: 'resp@test.com' },
      }),
    );
  }

  it('usuário da tarefa sem acesso ao chamado lê anexos e histórico via tarefa', async () => {
    mockTarefaDoResponsavel();
    prisma.chamado.findFirst.mockResolvedValue({
      id: 'chamado-1',
      fotoUrl: null,
      fotoMimeType: null,
      createdAt: new Date('2026-10-01T12:00:00.000Z'),
      registradoPorId: 'user-admin',
      registradoPor: { nome: 'Admin' },
      evidencias: [
        {
          id: 'ev-abertura',
          url: '/storage/abertura.jpg',
          storageKey: 'abertura.jpg',
          mimeType: 'image/jpeg',
          tamanhoBytes: 24,
          capturadaEm: new Date('2026-10-01T12:00:00.000Z'),
          metadata: { origem: 'abertura', nomeOriginal: 'fachada.jpg' },
        },
      ],
    });
    prisma.historicoStatus.findMany.mockResolvedValue([
      {
        id: 'h-chamado-1',
        statusAnterior: null,
        statusNovo: 'ABERTO',
        motivo: 'Chamado aberto',
        metadata: { tipo: 'abertura', evidenciaIds: ['ev-abertura'] },
        createdAt: new Date('2026-10-01T12:00:00.000Z'),
        alteradoPor: { id: 'user-admin', nome: 'Admin' },
      },
    ]);

    const resultado = await service.getChamadoLeituraViaTarefa('tarefa-1', 'chamado-1', userResponsavelTarefa());

    expect(resultado.somenteLeitura).toBe(true);
    expect(resultado.anexosAbertura).toHaveLength(1);
    expect(resultado.anexosAbertura[0]?.nome).toBe('fachada.jpg');
    expect(resultado.historico).toHaveLength(1);
    expect(resultado.historico[0]?.motivo).toBe('Chamado aberto');
    expect(resultado.historico[0]?.anexos).toHaveLength(1);
  });

  it('não devolve campo interno de metadata fora da whitelist da ficha', async () => {
    mockTarefaDoResponsavel();
    prisma.chamado.findFirst.mockResolvedValue({
      id: 'chamado-1',
      fotoUrl: null,
      fotoMimeType: null,
      createdAt: new Date('2026-10-01T12:00:00.000Z'),
      registradoPorId: 'user-admin',
      registradoPor: { nome: 'Admin' },
      evidencias: [],
    });
    prisma.historicoStatus.findMany.mockResolvedValue([
      {
        id: 'h-chamado-1',
        statusAnterior: null,
        statusNovo: 'ABERTO',
        motivo: 'Atualização de histórico',
        metadata: {
          tipo: 'HISTORY_UPDATE',
          descricao: 'Comentário visível na ficha',
          tokenInterno: 'segredo-nao-pode-sair',
          storageKeyInterna: 'evidencias/secreto.bin',
        },
        createdAt: new Date('2026-10-01T12:00:00.000Z'),
        alteradoPor: { id: 'user-admin', nome: 'Admin' },
      },
    ]);

    const resultado = await service.getChamadoLeituraViaTarefa('tarefa-1', 'chamado-1', userResponsavelTarefa());
    const metadata = resultado.historico[0]?.metadata ?? {};

    expect(metadata.tipo).toBe('HISTORY_UPDATE');
    expect(metadata.descricao).toBe('Comentário visível na ficha');
    expect(metadata).not.toHaveProperty('tokenInterno');
    expect(metadata).not.toHaveProperty('storageKeyInterna');
  });

  it('usuário sem acesso à tarefa é negado nessa via', async () => {
    prisma.chamadoTarefa.findFirst.mockResolvedValue(
      tarefaLoaded({ responsavelId: 'outro', equipeId: null }),
    );

    await expect(
      service.getChamadoLeituraViaTarefa('tarefa-1', 'chamado-1', userSemPermissao()),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(prisma.historicoStatus.findMany).not.toHaveBeenCalled();
  });

  it('tarefa de outro chamado não dá acesso (vínculo validado)', async () => {
    mockTarefaDoResponsavel();
    prisma.chamado.findFirst.mockResolvedValue({
      id: 'chamado-outro',
      fotoUrl: null,
      fotoMimeType: null,
      createdAt: new Date('2026-10-01T12:00:00.000Z'),
      registradoPorId: 'user-admin',
      registradoPor: { nome: 'Admin' },
      evidencias: [
        {
          id: 'ev-vazamento',
          url: '/storage/segredo.jpg',
          storageKey: 'segredo.jpg',
          mimeType: 'image/jpeg',
          tamanhoBytes: 24,
          capturadaEm: new Date('2026-10-01T12:00:00.000Z'),
          metadata: { origem: 'abertura', nomeOriginal: 'segredo-do-outro.jpg' },
        },
      ],
    });
    prisma.historicoStatus.findMany.mockResolvedValue([
      {
        id: 'h-vazamento',
        statusAnterior: null,
        statusNovo: 'ABERTO',
        motivo: 'Segredo do outro chamado',
        metadata: { tipo: 'HISTORY_UPDATE', descricao: 'não deveria vazar' },
        createdAt: new Date('2026-10-01T12:00:00.000Z'),
        alteradoPor: { id: 'user-admin', nome: 'Admin' },
      },
    ]);

    await expect(
      service.getChamadoLeituraViaTarefa('tarefa-1', 'chamado-outro', userResponsavelTarefa()),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(prisma.chamado.findFirst).not.toHaveBeenCalled();
    expect(prisma.historicoStatus.findMany).not.toHaveBeenCalled();
  });
});

describe('ChamadoTarefasService — auditoria de responsável e equipe', () => {
  const prisma = {
    chamado: { findFirst: vi.fn() },
    chamadoTarefa: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    chamadoTarefaAnexo: { create: vi.fn() },
    historicoStatus: { create: vi.fn(), findMany: vi.fn() },
    evidencia: { findMany: vi.fn() },
    secretaria: { findFirst: vi.fn(), findMany: vi.fn(), findUnique: vi.fn() },
    equipe: { findFirst: vi.fn(), findMany: vi.fn() },
    equipeUsuario: { findMany: vi.fn(), findUnique: vi.fn() },
    usuario: { findFirst: vi.fn() },
    perfil: { findUnique: vi.fn() },
  };
  const storage = { persistBuffer: vi.fn() };
  const audit = { record: vi.fn() };
  let service: ChamadoTarefasService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ChamadoTarefasService(prisma as never, storage as never, audit as never);
    prisma.secretaria.findFirst.mockResolvedValue({ id: 'sec-1' });
    prisma.equipeUsuario.findMany.mockResolvedValue([]);
    prisma.perfil.findUnique.mockResolvedValue(null);
    prisma.secretaria.findUnique.mockResolvedValue(null);
    prisma.historicoStatus.create.mockResolvedValue({ id: 'hist-1' });
    prisma.historicoStatus.findMany.mockResolvedValue([]);
    audit.record.mockResolvedValue(undefined);
  });

  it('trocar responsável gera evento de responsável', async () => {
    const before = tarefaLoaded({
      status: ChamadoTarefaStatus.VISUALIZADA,
      responsavelId: 'user-ana',
      responsavel: { id: 'user-ana', nome: 'Ana', email: 'ana@test.com' },
    });
    const after = tarefaLoaded({
      status: ChamadoTarefaStatus.VISUALIZADA,
      responsavelId: 'user-beto',
      responsavel: { id: 'user-beto', nome: 'Beto', email: 'beto@test.com' },
    });
    prisma.chamadoTarefa.findFirst.mockResolvedValue(before);
    prisma.chamadoTarefa.update.mockResolvedValue(after);
    prisma.usuario.findFirst.mockResolvedValue({ id: 'user-beto' });

    await service.update('tarefa-1', { responsavelId: 'user-beto' }, adminUser());

    const acoes = acoesTrilhaTarefa(prisma);
    expect(acoes).toEqual(['responsavel']);
    const gravado = prisma.historicoStatus.create.mock.calls
      .map((call) => call[0]?.data)
      .find((data) => data?.entidadeTipo === 'ChamadoTarefa');
    expect(gravado?.motivo).toContain('Responsável da tarefa alterado');
    expect(gravado?.metadata?.valorAnterior).toBe('Ana');
    expect(gravado?.metadata?.valorNovo).toBe('Beto');
    expect(gravado?.metadata?.resumo).toContain('Ana → Beto');
  });

  it('trocar equipe gera evento de equipe', async () => {
    const before = tarefaLoaded({
      status: ChamadoTarefaStatus.VISUALIZADA,
      equipeId: 'eq-1',
      equipe: { id: 'eq-1', nome: 'Equipe Norte', codigo: 'N' },
    });
    const after = tarefaLoaded({
      status: ChamadoTarefaStatus.VISUALIZADA,
      equipeId: 'eq-2',
      equipe: { id: 'eq-2', nome: 'Equipe Sul', codigo: 'S' },
    });
    prisma.chamadoTarefa.findFirst.mockResolvedValue(before);
    prisma.chamadoTarefa.update.mockResolvedValue(after);
    prisma.equipe.findFirst.mockResolvedValue({ id: 'eq-2' });

    await service.update('tarefa-1', { equipeId: 'eq-2' }, adminUser());

    const acoes = acoesTrilhaTarefa(prisma);
    expect(acoes).toEqual(['equipe']);
    const gravado = prisma.historicoStatus.create.mock.calls
      .map((call) => call[0]?.data)
      .find((data) => data?.entidadeTipo === 'ChamadoTarefa');
    expect(gravado?.motivo).toContain('Equipe da tarefa alterada');
    expect(gravado?.metadata?.valorAnterior).toBe('Equipe Norte');
    expect(gravado?.metadata?.valorNovo).toBe('Equipe Sul');
    expect(gravado?.metadata?.resumo).toContain('Equipe Norte → Equipe Sul');
  });

  it('trocar responsável e equipe juntos gera dois eventos distintos', async () => {
    const before = tarefaLoaded({
      status: ChamadoTarefaStatus.VISUALIZADA,
      equipeId: 'eq-1',
      equipe: { id: 'eq-1', nome: 'Equipe Norte', codigo: 'N' },
      responsavelId: 'user-ana',
      responsavel: { id: 'user-ana', nome: 'Ana', email: 'ana@test.com' },
    });
    const after = tarefaLoaded({
      status: ChamadoTarefaStatus.VISUALIZADA,
      equipeId: 'eq-2',
      equipe: { id: 'eq-2', nome: 'Equipe Sul', codigo: 'S' },
      responsavelId: 'user-beto',
      responsavel: { id: 'user-beto', nome: 'Beto', email: 'beto@test.com' },
    });
    prisma.chamadoTarefa.findFirst.mockResolvedValue(before);
    prisma.chamadoTarefa.update.mockResolvedValue(after);
    prisma.equipe.findFirst.mockResolvedValue({ id: 'eq-2' });
    prisma.usuario.findFirst.mockResolvedValue({ id: 'user-beto' });
    prisma.equipeUsuario.findUnique.mockResolvedValue({ equipeId: 'eq-2' });

    await service.update('tarefa-1', { equipeId: 'eq-2', responsavelId: 'user-beto' }, adminUser());

    expect(acoesTrilhaTarefa(prisma)).toEqual(['responsavel', 'equipe']);
  });
});

function userComPermissoes(permissoes: string[], sub = 'user-matriz'): JwtPayload {
  return {
    sub,
    email: `${sub}@test.com`,
    nome: 'Usuário matriz',
    perfis: [],
    permissoes,
    acessoTodasSecretarias: true,
    secretariaId: null,
    perfilAtivoId: null,
  };
}

describe('ChamadoTarefasService — permissões 269', () => {
  const prisma = {
    chamado: { findFirst: vi.fn() },
    chamadoTarefa: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    chamadoTarefaAnexo: { create: vi.fn() },
    historicoStatus: { create: vi.fn(), findMany: vi.fn() },
    evidencia: { findMany: vi.fn() },
    secretaria: { findFirst: vi.fn(), findMany: vi.fn(), findUnique: vi.fn() },
    equipe: { findFirst: vi.fn(), findMany: vi.fn() },
    equipeUsuario: { findMany: vi.fn(), findUnique: vi.fn() },
    usuario: { findFirst: vi.fn() },
    perfil: { findUnique: vi.fn() },
  };
  const storage = { persistBuffer: vi.fn() };
  const audit = { record: vi.fn() };
  let service: ChamadoTarefasService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ChamadoTarefasService(prisma as never, storage as never, audit as never);
    prisma.secretaria.findFirst.mockResolvedValue({ id: 'sec-1' });
    prisma.equipeUsuario.findMany.mockResolvedValue([]);
    prisma.equipeUsuario.findUnique.mockResolvedValue(null);
    prisma.perfil.findUnique.mockResolvedValue(null);
    prisma.secretaria.findUnique.mockResolvedValue(null);
    prisma.historicoStatus.create.mockResolvedValue({ id: 'hist-1' });
    prisma.historicoStatus.findMany.mockResolvedValue([]);
    audit.record.mockResolvedValue(undefined);
  });

  function mockTarefa(overrides: Record<string, unknown> = {}) {
    const loaded = tarefaLoaded({
      status: ChamadoTarefaStatus.VISUALIZADA,
      anexos: [
        {
          id: 'anexo-hist',
          nome: 'foto.jpg',
          url: '/storage/foto.jpg',
          mimeType: 'image/jpeg',
          tamanhoBytes: 24,
          createdAt: new Date('2026-10-01T12:00:00.000Z'),
        },
      ],
      ...overrides,
    });
    prisma.chamadoTarefa.findFirst.mockResolvedValue(loaded);
    prisma.chamadoTarefa.update.mockResolvedValue(loaded);
    return loaded;
  }

  it('responsável sem alterar dados não edita título/prazo/secretaria', async () => {
    mockTarefa({
      responsavelId: 'user-resp',
      responsavel: { id: 'user-resp', nome: 'Responsável da tarefa', email: 'resp@test.com' },
    });

    await expect(
      service.update('tarefa-1', { titulo: 'Novo título da tarefa' }, userResponsavelTarefa()),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(prisma.chamadoTarefa.update).not.toHaveBeenCalled();
  });

  it('com a permissão de alterar dados a edição passa', async () => {
    const before = mockTarefa();
    const after = tarefaLoaded({ ...before, titulo: 'Novo título da tarefa', status: ChamadoTarefaStatus.VISUALIZADA });
    prisma.chamadoTarefa.update.mockResolvedValue(after);

    const user = userComPermissoes([
      'matriz.chamados.tarefas.visualizar',
      'matriz.chamados.tarefas.alterar',
    ]);
    const resultado = await service.update('tarefa-1', { titulo: 'Novo título da tarefa' }, user);

    expect(resultado.titulo).toBe('Novo título da tarefa');
    expect(prisma.chamadoTarefa.update).toHaveBeenCalled();
  });

  it('cancela com tarefas_cancelar.executar', async () => {
    mockTarefa();
    const user = userComPermissoes([
      'matriz.chamados.tarefas.visualizar',
      'matriz.chamados.tarefas_cancelar.executar',
    ]);

    await service.update('tarefa-1', { status: ChamadoTarefaStatus.CANCELADA, justificativa: 'Fora de escopo da equipe' }, user);

    expect(prisma.chamadoTarefa.update).toHaveBeenCalled();
    const data = prisma.chamadoTarefa.update.mock.calls[0]?.[0]?.data;
    expect(data?.status).toBe(ChamadoTarefaStatus.CANCELADA);
    expect(data?.justificativa).toBe('Fora de escopo da equipe');
  });

  it('cancela com a chave legada tarefas.excluir', async () => {
    mockTarefa();
    const user = userComPermissoes(['matriz.chamados.tarefas.visualizar', 'matriz.chamados.tarefas.excluir']);

    await service.update('tarefa-1', { status: ChamadoTarefaStatus.CANCELADA, justificativa: 'Pedido do gestor' }, user);

    expect(prisma.chamadoTarefa.update).toHaveBeenCalled();
  });

  it('recusa cancelar sem a permissão nova e sem a chave legada', async () => {
    mockTarefa({
      responsavelId: 'user-resp',
      responsavel: { id: 'user-resp', nome: 'Responsável da tarefa', email: 'resp@test.com' },
    });

    await expect(
      service.update(
        'tarefa-1',
        { status: ChamadoTarefaStatus.CANCELADA, justificativa: 'Quero cancelar mesmo assim' },
        userResponsavelTarefa(),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(prisma.chamadoTarefa.update).not.toHaveBeenCalled();
  });

  it('recusa cancelar sem justificativa', async () => {
    mockTarefa();
    const user = userComPermissoes([
      'matriz.chamados.tarefas.visualizar',
      'matriz.chamados.tarefas_cancelar.executar',
    ]);

    await expect(service.update('tarefa-1', { status: ChamadoTarefaStatus.CANCELADA }, user)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(
      service.update('tarefa-1', { status: ChamadoTarefaStatus.CANCELADA, justificativa: 'ab' }, user),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.chamadoTarefa.update).not.toHaveBeenCalled();
  });

  it('sem tarefas_historico.visualizar não devolve histórico nem anexos', async () => {
    mockTarefa();
    prisma.historicoStatus.findMany.mockResolvedValue([
      {
        id: 'h-tarefa',
        motivo: 'Criação',
        statusAnterior: null,
        statusNovo: 'NOVA',
        createdAt: new Date('2026-10-01T12:00:00.000Z'),
        alteradoPor: { id: 'user-admin', nome: 'Admin' },
        metadata: { acao: 'criada', anexoIds: ['anexo-hist'] },
      },
    ]);
    const user = userComPermissoes(['matriz.chamados.tarefas.visualizar']);

    const resultado = await service.getById('tarefa-1', user);

    expect(resultado.podeVerHistorico).toBe(false);
    expect(resultado.historico).toEqual([]);
    expect(resultado.anexos).toEqual([]);
    expect(prisma.historicoStatus.findMany).not.toHaveBeenCalled();
  });

  it('com tarefas_historico.visualizar devolve histórico e anexos', async () => {
    mockTarefa();
    prisma.historicoStatus.findMany.mockResolvedValue([
      {
        id: 'h-tarefa',
        motivo: 'Criação',
        statusAnterior: null,
        statusNovo: 'NOVA',
        createdAt: new Date('2026-10-01T12:00:00.000Z'),
        alteradoPor: { id: 'user-admin', nome: 'Admin' },
        metadata: { acao: 'criada', anexoIds: ['anexo-hist'] },
      },
    ]);
    const user = userComPermissoes([
      'matriz.chamados.tarefas.visualizar',
      'matriz.chamados.tarefas_historico.visualizar',
    ]);

    const resultado = await service.getById('tarefa-1', user);

    expect(resultado.podeVerHistorico).toBe(true);
    expect(resultado.historico).toHaveLength(1);
    expect(resultado.historico[0]?.motivo).toBe('Criação');
    expect(resultado.anexos).toHaveLength(1);
    expect(resultado.anexos[0]?.nome).toBe('foto.jpg');
  });

  it('administrador do sistema altera, cancela e vê histórico', async () => {
    mockTarefa();
    prisma.historicoStatus.findMany.mockResolvedValue([
      {
        id: 'h-tarefa',
        motivo: 'Criação',
        statusAnterior: null,
        statusNovo: 'NOVA',
        createdAt: new Date('2026-10-01T12:00:00.000Z'),
        alteradoPor: { id: 'user-admin', nome: 'Admin' },
        metadata: { acao: 'criada' },
      },
    ]);

    const detalhe = await service.getById('tarefa-1', adminUser());
    expect(detalhe.podeAlterarDados).toBe(true);
    expect(detalhe.podeCancelar).toBe(true);
    expect(detalhe.podeVerHistorico).toBe(true);
    expect(detalhe.historico).toHaveLength(1);
    expect(detalhe.anexos).toHaveLength(1);

    await service.update('tarefa-1', { titulo: 'Título ajustado pelo admin' }, adminUser());
    expect(prisma.chamadoTarefa.update).toHaveBeenCalled();

    prisma.chamadoTarefa.update.mockClear();
    await service.update(
      'tarefa-1',
      { status: ChamadoTarefaStatus.CANCELADA, justificativa: 'Cancelamento administrativo' },
      adminUser(),
    );
    expect(prisma.chamadoTarefa.update.mock.calls[0]?.[0]?.data?.status).toBe(ChamadoTarefaStatus.CANCELADA);
  });
});
