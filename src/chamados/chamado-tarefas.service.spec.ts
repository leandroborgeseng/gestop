import { BadRequestException, ForbiddenException } from '@nestjs/common';
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
