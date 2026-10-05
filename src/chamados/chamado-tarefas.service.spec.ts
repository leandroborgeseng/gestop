import { Test } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { ChamadoPrioridade, ChamadoTarefaStatus } from '@prisma/client';
import { ChamadoTarefasService } from './chamado-tarefas.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { AuditService } from '../audit/audit.service';
import type { JwtPayload } from '../auth/jwt';

const mockPrisma = {
  chamado: { findFirst: jest.fn() },
  chamadoTarefa: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  chamadoTarefaAnexo: { create: jest.fn() },
  historicoStatus: { create: jest.fn(), findMany: jest.fn() },
  secretaria: { findFirst: jest.fn(), findMany: jest.fn(), findUnique: jest.fn() },
  equipe: { findFirst: jest.fn(), findMany: jest.fn() },
  equipeUsuario: { findMany: jest.fn(), findUnique: jest.fn() },
  usuario: { findFirst: jest.fn() },
  perfil: { findUnique: jest.fn() },
};

const mockStorage = {
  persistBuffer: jest.fn(),
};

const mockAudit = {
  record: jest.fn(),
};

describe('ChamadoTarefasService', () => {
  let service: ChamadoTarefasService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        ChamadoTarefasService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: StorageService, useValue: mockStorage },
        { provide: AuditService, useValue: mockAudit },
      ],
    }).compile();

    service = module.get(ChamadoTarefasService);
    jest.clearAllMocks();
  });

  describe('create', () => {
    const adminUser: JwtPayload = {
      sub: 'user-1',
      email: 'admin@test.com',
      nome: 'Admin',
      perfis: ['Administrador do Sistema'],
      permissoes: ['administrador_sistema'],
      secretariaId: null,
      perfilAtivoId: null,
    };

    const chamadoMock = {
      id: 'chamado-1',
      codigo: 'CH-001',
      status: 'ABERTO',
      excluidoEm: null,
    };

    const tarefaCriadaMock = {
      id: 'tarefa-1',
      chamadoId: 'chamado-1',
      titulo: 'Análise técnica',
      descricao: 'Realizar análise',
      prazo: new Date('2026-10-10'),
      secretariaId: 'sec-1',
      equipeId: 'equipe-1',
      responsavelId: 'user-2',
      prioridade: ChamadoPrioridade.MEDIA,
      status: ChamadoTarefaStatus.NOVA,
      criadaPorId: 'user-1',
      createdAt: new Date(),
      updatedAt: new Date(),
      visualizadaEm: null,
      concluidaEm: null,
      concluidaPorId: null,
      canceladaEm: null,
      justificativa: null,
      conclusaoTexto: null,
      observacao: null,
      secretaria: { id: 'sec-1', nome: 'Secretaria Teste', sigla: 'ST' },
      equipe: { id: 'equipe-1', nome: 'Equipe 1', codigo: 'EQ1' },
      responsavel: { id: 'user-2', nome: 'Responsável', email: 'resp@test.com' },
      criadaPor: { id: 'user-1', nome: 'Admin' },
      concluidaPor: null,
      anexos: [],
      chamado: {
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
      },
    };

    beforeEach(() => {
      mockPrisma.chamado.findFirst.mockResolvedValue(chamadoMock);
      mockPrisma.secretaria.findFirst.mockResolvedValue({ id: 'sec-1' });
      mockPrisma.equipe.findFirst.mockResolvedValue({ id: 'equipe-1' });
      mockPrisma.usuario.findFirst.mockResolvedValue({ id: 'user-2' });
      mockPrisma.equipeUsuario.findMany.mockResolvedValue([{ equipeId: 'equipe-1' }]);
      mockPrisma.equipeUsuario.findUnique.mockResolvedValue({ equipeId: 'equipe-1' });
      mockPrisma.perfil.findUnique.mockResolvedValue(null);
      mockPrisma.secretaria.findUnique.mockResolvedValue(null);
    });

    it('cria tarefa sem anexos', async () => {
      mockPrisma.chamadoTarefa.create.mockResolvedValue(tarefaCriadaMock);
      mockPrisma.chamadoTarefa.findFirst.mockResolvedValue(tarefaCriadaMock);
      mockPrisma.historicoStatus.create.mockResolvedValue({ id: 'hist-1' });
      mockAudit.record.mockResolvedValue(undefined);

      const resultado = await service.create(
        {
          chamadoId: 'chamado-1',
          titulo: 'Análise técnica',
          descricao: 'Realizar análise',
          prazo: '2026-10-10T00:00:00.000Z',
          secretariaId: 'sec-1',
          equipeId: 'equipe-1',
          responsavelId: 'user-2',
          prioridade: ChamadoPrioridade.MEDIA,
        },
        adminUser,
      );

      expect(resultado.titulo).toBe('Análise técnica');
      expect(resultado.anexos).toHaveLength(0);
      expect(mockPrisma.chamadoTarefaAnexo.create).not.toHaveBeenCalled();
      expect(mockStorage.persistBuffer).not.toHaveBeenCalled();
    });

    it('cria tarefa com anexos', async () => {
      mockPrisma.chamadoTarefa.create.mockResolvedValue(tarefaCriadaMock);
      const tarefaComAnexo = {
        ...tarefaCriadaMock,
        anexos: [
          {
            id: 'anexo-1',
            nome: 'foto.jpg',
            url: 'https://storage.test/foto.jpg',
            mimeType: 'image/jpeg',
            tamanhoBytes: 1024,
            createdAt: new Date(),
          },
        ],
      };
      mockPrisma.chamadoTarefa.findFirst.mockResolvedValue(tarefaComAnexo);
      mockStorage.persistBuffer.mockResolvedValue({
        url: 'https://storage.test/foto.jpg',
        storageKey: 'key-1',
        mimeType: 'image/jpeg',
        tamanhoBytes: 1024,
      });
      mockPrisma.chamadoTarefaAnexo.create.mockResolvedValue({ id: 'anexo-1' });
      mockPrisma.historicoStatus.create.mockResolvedValue({ id: 'hist-1' });
      mockAudit.record.mockResolvedValue(undefined);

      const resultado = await service.create(
        {
          chamadoId: 'chamado-1',
          titulo: 'Análise técnica',
          secretariaId: 'sec-1',
          anexos: [
            {
              dataUrl: 'data:image/jpeg;base64,/9j/4AAQSkZJRg==',
              nome: 'foto.jpg',
            },
          ],
        },
        adminUser,
      );

      expect(resultado.anexos).toHaveLength(1);
      expect(resultado.anexos[0].nome).toBe('foto.jpg');
      expect(mockStorage.persistBuffer).toHaveBeenCalledTimes(1);
      expect(mockPrisma.chamadoTarefaAnexo.create).toHaveBeenCalledTimes(1);
    });

    it('bloqueia criação sem permissão', async () => {
      const userSemPermissao: JwtPayload = {
        sub: 'user-3',
        email: 'user@test.com',
        nome: 'Usuário',
        perfis: [],
        permissoes: [],
        secretariaId: null,
        perfilAtivoId: null,
      };

      await expect(
        service.create(
          {
            chamadoId: 'chamado-1',
            titulo: 'Teste',
            secretariaId: 'sec-1',
          },
          userSemPermissao,
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('listByChamado - agrupamento de tarefas', () => {
    const adminUser: JwtPayload = {
      sub: 'user-1',
      email: 'admin@test.com',
      nome: 'Admin',
      perfis: ['Administrador do Sistema'],
      permissoes: ['administrador_sistema'],
      secretariaId: null,
      perfilAtivoId: null,
    };

    const chamadoMock = {
      id: 'chamado-1',
      codigo: 'CH-001',
      status: 'ABERTO',
      excluidoEm: null,
    };

    const tarefasMock = [
      {
        id: 't1',
        titulo: 'Tarefa nova',
        status: ChamadoTarefaStatus.NOVA,
        createdAt: new Date('2026-10-01'),
        prazo: null,
        secretariaId: 'sec-1',
        equipeId: null,
        responsavelId: null,
        prioridade: ChamadoPrioridade.MEDIA,
        chamadoId: 'chamado-1',
        descricao: null,
        justificativa: null,
        conclusaoTexto: null,
        observacao: null,
        visualizadaEm: null,
        concluidaEm: null,
        concluidaPorId: null,
        canceladaEm: null,
        criadaPorId: 'user-1',
        updatedAt: new Date(),
        secretaria: { id: 'sec-1', nome: 'ST', sigla: 'ST' },
        equipe: null,
        responsavel: null,
        criadaPor: { id: 'user-1', nome: 'Admin' },
        concluidaPor: null,
        anexos: [],
        chamado: {
          id: 'chamado-1',
          codigo: 'CH-001',
          titulo: null,
          descricao: 'Teste',
          status: 'ABERTO',
          prioridade: 'MEDIA',
          enderecoTexto: null,
          prazoEm: null,
          excluidoEm: null,
          latitude: null,
          longitude: null,
          tipoChamado: null,
          unidade: null,
          secretaria: { id: 'sec-1', nome: 'ST', sigla: 'ST' },
          equipe: null,
        },
      },
      {
        id: 't2',
        titulo: 'Tarefa em andamento',
        status: ChamadoTarefaStatus.EM_ANDAMENTO,
        createdAt: new Date('2026-10-02'),
        prazo: null,
        secretariaId: 'sec-1',
        equipeId: null,
        responsavelId: null,
        prioridade: ChamadoPrioridade.MEDIA,
        chamadoId: 'chamado-1',
        descricao: null,
        justificativa: null,
        conclusaoTexto: null,
        observacao: 'Iniciada',
        visualizadaEm: new Date('2026-10-02'),
        concluidaEm: null,
        concluidaPorId: null,
        canceladaEm: null,
        criadaPorId: 'user-1',
        updatedAt: new Date(),
        secretaria: { id: 'sec-1', nome: 'ST', sigla: 'ST' },
        equipe: null,
        responsavel: null,
        criadaPor: { id: 'user-1', nome: 'Admin' },
        concluidaPor: null,
        anexos: [],
        chamado: {
          id: 'chamado-1',
          codigo: 'CH-001',
          titulo: null,
          descricao: 'Teste',
          status: 'ABERTO',
          prioridade: 'MEDIA',
          enderecoTexto: null,
          prazoEm: null,
          excluidoEm: null,
          latitude: null,
          longitude: null,
          tipoChamado: null,
          unidade: null,
          secretaria: { id: 'sec-1', nome: 'ST', sigla: 'ST' },
          equipe: null,
        },
      },
      {
        id: 't3',
        titulo: 'Tarefa concluída',
        status: ChamadoTarefaStatus.CONCLUIDA,
        createdAt: new Date('2026-09-20'),
        prazo: null,
        secretariaId: 'sec-1',
        equipeId: null,
        responsavelId: null,
        prioridade: ChamadoPrioridade.MEDIA,
        chamadoId: 'chamado-1',
        descricao: null,
        justificativa: null,
        conclusaoTexto: 'Concluída',
        observacao: null,
        visualizadaEm: new Date('2026-09-20'),
        concluidaEm: new Date('2026-09-25'),
        concluidaPorId: 'user-1',
        canceladaEm: null,
        criadaPorId: 'user-1',
        updatedAt: new Date(),
        secretaria: { id: 'sec-1', nome: 'ST', sigla: 'ST' },
        equipe: null,
        responsavel: null,
        criadaPor: { id: 'user-1', nome: 'Admin' },
        concluidaPor: { id: 'user-1', nome: 'Admin' },
        anexos: [],
        chamado: {
          id: 'chamado-1',
          codigo: 'CH-001',
          titulo: null,
          descricao: 'Teste',
          status: 'ABERTO',
          prioridade: 'MEDIA',
          enderecoTexto: null,
          prazoEm: null,
          excluidoEm: null,
          latitude: null,
          longitude: null,
          tipoChamado: null,
          unidade: null,
          secretaria: { id: 'sec-1', nome: 'ST', sigla: 'ST' },
          equipe: null,
        },
      },
      {
        id: 't4',
        titulo: 'Tarefa cancelada',
        status: ChamadoTarefaStatus.CANCELADA,
        createdAt: new Date('2026-09-15'),
        prazo: null,
        secretariaId: 'sec-1',
        equipeId: null,
        responsavelId: null,
        prioridade: ChamadoPrioridade.MEDIA,
        chamadoId: 'chamado-1',
        descricao: null,
        justificativa: 'Não é mais necessária',
        conclusaoTexto: null,
        observacao: null,
        visualizadaEm: new Date('2026-09-15'),
        concluidaEm: null,
        concluidaPorId: null,
        canceladaEm: new Date('2026-09-16'),
        criadaPorId: 'user-1',
        updatedAt: new Date(),
        secretaria: { id: 'sec-1', nome: 'ST', sigla: 'ST' },
        equipe: null,
        responsavel: null,
        criadaPor: { id: 'user-1', nome: 'Admin' },
        concluidaPor: null,
        anexos: [],
        chamado: {
          id: 'chamado-1',
          codigo: 'CH-001',
          titulo: null,
          descricao: 'Teste',
          status: 'ABERTO',
          prioridade: 'MEDIA',
          enderecoTexto: null,
          prazoEm: null,
          excluidoEm: null,
          latitude: null,
          longitude: null,
          tipoChamado: null,
          unidade: null,
          secretaria: { id: 'sec-1', nome: 'ST', sigla: 'ST' },
          equipe: null,
        },
      },
    ];

    beforeEach(() => {
      mockPrisma.chamado.findFirst.mockResolvedValue(chamadoMock);
      mockPrisma.equipeUsuario.findMany.mockResolvedValue([]);
    });

    it('conta pendentes corretamente (abertas = NOVA + EM_ANDAMENTO + VISUALIZADA)', async () => {
      mockPrisma.chamadoTarefa.findMany.mockResolvedValue(tarefasMock);

      const resultado = await service.listByChamado('chamado-1', adminUser);

      expect(resultado.total).toBe(4);
      expect(resultado.pendentes).toBe(2);
      const statusPendentes = resultado.items
        .filter((item) => item.status !== 'CONCLUIDA' && item.status !== 'CANCELADA')
        .map((item) => item.status);
      expect(statusPendentes).toEqual(expect.arrayContaining(['NOVA', 'EM_ANDAMENTO']));
    });

    it('separa encerradas (CONCLUIDA e CANCELADA) das abertas', async () => {
      mockPrisma.chamadoTarefa.findMany.mockResolvedValue(tarefasMock);

      const resultado = await service.listByChamado('chamado-1', adminUser);

      const abertas = resultado.items.filter((item) => item.status !== 'CONCLUIDA' && item.status !== 'CANCELADA');
      const encerradas = resultado.items.filter((item) => item.status === 'CONCLUIDA' || item.status === 'CANCELADA');

      expect(abertas.length).toBe(2);
      expect(encerradas.length).toBe(2);
      expect(encerradas.map((t) => t.status)).toEqual(expect.arrayContaining(['CONCLUIDA', 'CANCELADA']));
    });
  });
});
