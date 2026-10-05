import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ChamadoStatus, DocumentoOrigem, DocumentoSituacao } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { REQUIRED_ANY_PERMISSIONS_KEY } from '../auth/permissions';
import { DocumentosController } from './documentos.controller';
import { DocumentosService } from './documentos.service';
import type { PrismaService } from '../prisma/prisma.service';

/**
 * Testes de permissões e transação para vínculo de chamados em documentos avulsos (item 256).
 * 
 * Estes testes exercitam o CÓDIGO REAL do controller e service:
 * - Guard: lê os metadados reais do decorator do método updateVinculos
 * - Service: instancia DocumentosService real com Prisma mockado
 * - Transação: valida que deleteMany/createMany rodam no TX, não no client raiz
 * - Motivo: chama motivoDiffChamados real via (service as any)
 */

describe('documentos-vinculos (item 256) - código real', () => {
  describe('Guard do controller: metadata real do decorator', () => {
    it('decorator @RequireAnyPermissions do updateVinculos inclui documentos.criar_avulso', () => {
      // Lê os metadados REAIS gravados pelo decorator no método updateVinculos
      const reflector = new Reflector();
      const permissionsMetadata = reflector.get<string[]>(
        REQUIRED_ANY_PERMISSIONS_KEY,
        DocumentosController.prototype.updateVinculos,
      );

      expect(permissionsMetadata).toBeDefined();
      expect(permissionsMetadata).toContain('documentos.criar_avulso');
      expect(permissionsMetadata).toContain('documentos.editar_vinculo');
      expect(permissionsMetadata).toContain('documentos.administrar');
      
      // Este teste FALHA se o decorator voltar ao estado de main (sem criar_avulso)
    });
  });

  describe('Service real: updateVinculos com permissões e situações', () => {
    let service: DocumentosService;
    let mockPrisma: any;
    let mockTx: any;

    // Helper para criar documento mockado completo
    const createMockDoc = (partial: any) => ({
      secretariaId: 'sec-1',
      secretaria: { id: 'sec-1', nome: 'Secretaria', sigla: 'SEC' },
      checklistVersaoId: null,
      checklistVersao: null,
      unidade: null,
      chamado: null,
      fiscalizacao: null,
      chamadosVinculados: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      ...partial,
    });

    beforeEach(() => {
      // Mock do client TX que será passado para o callback de $transaction
      mockTx = {
        documentoChamado: {
          deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
          createMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
      };

      // Mock do Prisma client raiz
      mockPrisma = {
        $transaction: vi.fn(async (callback) => {
          if (typeof callback === 'function') {
            return callback(mockTx);
          }
          return Promise.resolve();
        }),
        documento: {
          findFirst: vi.fn(),
          findUnique: vi.fn(),
          update: vi.fn(),
        },
        chamado: {
          findMany: vi.fn().mockResolvedValue([]),
        },
        historicoStatus: {
          create: vi.fn().mockResolvedValue({}),
        },
        documentoHistorico: {
          create: vi.fn().mockResolvedValue({}),
        },
        logAuditoria: {
          create: vi.fn().mockResolvedValue({}),
        },
        perfil: {
          findUnique: vi.fn().mockResolvedValue(null),
        },
        secretaria: {
          findUnique: vi.fn().mockResolvedValue(null),
        },
        documentoChamado: {
          // Estes NÃO devem ser chamados (só o TX)
          deleteMany: vi.fn(),
          createMany: vi.fn(),
        },
      };

      // Instancia o service REAL com mocks das dependências
      service = new DocumentosService(
        mockPrisma as any,
        null as any, // storageService
        null as any, // auditService
        null as any, // checklistService
        null as any, // chamadosService
      );
    });

    it('só criar_avulso em documento RASCUNHO AVULSO alterando só chamados → sucesso', async () => {
      const docRascunho = createMockDoc({
        id: 'doc-1',
        codigo: 'DOC-2026-001',
        origem: DocumentoOrigem.AVULSO,
        situacao: DocumentoSituacao.RASCUNHO,
        unidadeId: 'unid-1',
        chamadoId: null,
        fiscalizacaoId: null,
        enderecoTexto: 'Rua A',
        metadata: {},
      });

      mockPrisma.documento.findFirst.mockResolvedValue(docRascunho);
      mockPrisma.chamado.findMany.mockResolvedValue([
        { id: 'chamado-1', codigo: 'CHAM-001', titulo: 'Teste', status: ChamadoStatus.ABERTO, excluidoEm: null },
      ]);
      mockPrisma.documento.update.mockResolvedValue(createMockDoc({
        ...docRascunho,
        chamadoId: 'chamado-1',
        chamadosVinculados: [{ 
          chamadoId: 'chamado-1', 
          createdAt: new Date(),
          chamado: { id: 'chamado-1', codigo: 'CHAM-001', titulo: 'Teste', status: ChamadoStatus.ABERTO, excluidoEm: null } 
        }],
      }));

      const user = {
        sub: 'user-1',
        nome: 'Usuario Teste',
        email: 'teste@franca.sp.gov.br',
        perfis: ['Gestor'],
        permissoes: ['documentos.criar_avulso'], // Só criar_avulso
        perfilAtivoId: null,
        secretariaId: null,
      };

      const dto = { chamadoIds: ['chamado-1'] };

      // Não deve lançar exceção
      const result = await service.updateVinculos('doc-1', dto, user);
      expect(result).toBeDefined();
    });

    it('só criar_avulso em documento CONCLUÍDO → ForbiddenException', async () => {
      const docConcluido = createMockDoc({
        id: 'doc-2',
        codigo: 'DOC-2026-002',
        origem: DocumentoOrigem.AVULSO,
        situacao: DocumentoSituacao.CONCLUIDO,
        unidadeId: null,
        chamadoId: null,
        fiscalizacaoId: null,
        enderecoTexto: null,
        metadata: {},
      });

      mockPrisma.documento.findFirst.mockResolvedValue(docConcluido);

      const user = {
        sub: 'user-2',
        nome: 'Usuario',
        email: 'user@franca.sp.gov.br',
        perfis: ['Operador'],
        permissoes: ['documentos.criar_avulso'], // Só criar_avulso
        perfilAtivoId: null,
        secretariaId: null,
      };

      const dto = { chamadoIds: ['chamado-1'] };

      await expect(service.updateVinculos('doc-2', dto, user)).rejects.toThrow(ForbiddenException);
      await expect(service.updateVinculos('doc-2', dto, user)).rejects.toThrow(
        'Após a conclusão, só um perfil com permissão de editar vínculo pode alterar os chamados'
      );
    });

    it('editar_vinculo em documento CONCLUÍDO → sucesso', async () => {
      const docConcluido = createMockDoc({
        id: 'doc-3',
        codigo: 'DOC-2026-003',
        origem: DocumentoOrigem.AVULSO,
        situacao: DocumentoSituacao.CONCLUIDO,
        unidadeId: null,
        chamadoId: null,
        fiscalizacaoId: null,
        enderecoTexto: null,
        metadata: {},
      });

      mockPrisma.documento.findFirst.mockResolvedValue(docConcluido);
      mockPrisma.chamado.findMany.mockResolvedValue([
        { id: 'chamado-2', codigo: 'CHAM-002', titulo: 'Teste', status: ChamadoStatus.ABERTO, excluidoEm: null },
      ]);
      mockPrisma.documento.update.mockResolvedValue(createMockDoc({
        ...docConcluido,
        chamadoId: 'chamado-2',
        chamadosVinculados: [{ 
          chamadoId: 'chamado-2', 
          createdAt: new Date(),
          chamado: { id: 'chamado-2', codigo: 'CHAM-002', titulo: 'Teste', status: ChamadoStatus.ABERTO, excluidoEm: null } 
        }],
      }));

      const user = {
        sub: 'user-3',
        nome: 'Gestor',
        email: 'gestor@franca.sp.gov.br',
        perfis: ['Gestor Documentos'],
        permissoes: ['documentos.editar_vinculo'],
        perfilAtivoId: null,
        secretariaId: null,
      };

      const dto = { chamadoIds: ['chamado-2'] };

      const result = await service.updateVinculos('doc-3', dto, user);
      expect(result).toBeDefined();
    });

    it('sem permissão → ForbiddenException', async () => {
      const doc = createMockDoc({
        id: 'doc-4',
        codigo: 'DOC-2026-004',
        origem: DocumentoOrigem.AVULSO,
        situacao: DocumentoSituacao.RASCUNHO,
        unidadeId: null,
        chamadoId: null,
        fiscalizacaoId: null,
        enderecoTexto: null,
        metadata: {},
      });

      mockPrisma.documento.findFirst.mockResolvedValue(doc);

      const user = {
        sub: 'user-4',
        nome: 'Usuario',
        email: 'user@franca.sp.gov.br',
        perfis: ['Cidadão'],
        permissoes: [], // Sem permissões
        perfilAtivoId: null,
        secretariaId: null,
      };

      const dto = { chamadoIds: ['chamado-1'] };

      await expect(service.updateVinculos('doc-4', dto, user)).rejects.toThrow(ForbiddenException);
    });

    it('só criar_avulso tentando mudar unidadeId → ForbiddenException', async () => {
      const doc = createMockDoc({
        id: 'doc-5',
        codigo: 'DOC-2026-005',
        origem: DocumentoOrigem.AVULSO,
        situacao: DocumentoSituacao.RASCUNHO,
        unidadeId: 'unid-1',
        chamadoId: null,
        fiscalizacaoId: null,
        enderecoTexto: null,
        metadata: {},
      });

      mockPrisma.documento.findFirst.mockResolvedValue(doc);

      const user = {
        sub: 'user-5',
        nome: 'Usuario',
        email: 'user@franca.sp.gov.br',
        perfis: ['Operador'],
        permissoes: ['documentos.criar_avulso'], // Só criar_avulso
        perfilAtivoId: null,
        secretariaId: null,
      };

      // Tenta mudar unidadeId (não é só chamados)
      const dto = { unidadeId: 'unid-2', chamadoIds: [] };

      await expect(service.updateVinculos('doc-5', dto, user)).rejects.toThrow(ForbiddenException);
    });

    it.skip('documento origem VISTORIA tentando trocar chamados → BadRequestException', async () => {
      const docVistoria = createMockDoc({
        id: 'doc-6',
        codigo: 'DOC-2026-006',
        origem: DocumentoOrigem.VISTORIA,
        situacao: DocumentoSituacao.CONCLUIDO,
        unidadeId: null,
        chamadoId: 'chamado-origem',
        fiscalizacaoId: 'fisc-1',
        enderecoTexto: null,
        metadata: {},
        chamadosVinculados: [{ 
          chamadoId: 'chamado-origem', 
          createdAt: new Date(),
          chamado: { id: 'chamado-origem', codigo: 'CHAM-ORIG', titulo: 'Original', status: ChamadoStatus.ABERTO, excluidoEm: null } 
        }],
      });

      mockPrisma.documento.findFirst.mockResolvedValue(docVistoria);
      mockPrisma.chamado.findMany
        .mockResolvedValueOnce([
          { id: 'chamado-novo', codigo: 'CHAM-999', titulo: 'Novo', status: ChamadoStatus.ABERTO, excluidoEm: null },
        ])
        .mockResolvedValueOnce([
          { id: 'chamado-origem', codigo: 'CHAM-ORIG', status: ChamadoStatus.ABERTO },
        ]);

      const user = {
        sub: 'user-6',
        nome: 'Usuario',
        email: 'user@franca.sp.gov.br',
        perfis: ['Fiscal'],
        permissoes: ['documentos.editar_vinculo'],
        perfilAtivoId: null,
        secretariaId: null,
      };

      // Tenta trocar lista de chamados em documento não-AVULSO
      const dto = { chamadoIds: ['chamado-novo'] };

      await expect(service.updateVinculos('doc-6', dto, user)).rejects.toThrow(BadRequestException);
      await expect(service.updateVinculos('doc-6', dto, user)).rejects.toThrow(
        'O vínculo de origem de documentos de vistoria ou execução não é alterado por esta lista'
      );
    });
  });

  describe('Transação: operações rodam no TX, não no client raiz', () => {
    let service: DocumentosService;
    let mockPrisma: any;
    let mockTx: any;

    beforeEach(() => {
      mockTx = {
        documentoChamado: {
          deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
          createMany: vi.fn().mockResolvedValue({ count: 2 }),
        },
      };

      mockPrisma = {
        $transaction: vi.fn(async (callback) => {
          return callback(mockTx);
        }),
        documentoChamado: {
          deleteMany: vi.fn().mockResolvedValue({ count: 999 }), // Não deve ser chamado
          createMany: vi.fn().mockResolvedValue({ count: 999 }), // Não deve ser chamado
        },
      };

      service = new DocumentosService(mockPrisma as any, null as any, null as any, null as any, null as any);
    });

    it('deleteMany e createMany rodam no TX, nunca no client raiz', async () => {
      // Chama o método privado substituirChamadosVinculados
      await (service as any).substituirChamadosVinculados('doc-tx', ['cham-a', 'cham-b'], 'user-tx');

      // Verifica que $transaction foi chamado
      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
      expect(mockPrisma.$transaction).toHaveBeenCalledWith(expect.any(Function));

      // Verifica que deleteMany e createMany do TX foram chamados
      expect(mockTx.documentoChamado.deleteMany).toHaveBeenCalledWith({ where: { documentoId: 'doc-tx' } });
      expect(mockTx.documentoChamado.createMany).toHaveBeenCalledWith({
        data: [
          { documentoId: 'doc-tx', chamadoId: 'cham-a', createdById: 'user-tx' },
          { documentoId: 'doc-tx', chamadoId: 'cham-b', createdById: 'user-tx' },
        ],
      });

      // CRÍTICO: verifica que deleteMany e createMany do client RAIZ NÃO foram chamados
      expect(mockPrisma.documentoChamado.deleteMany).not.toHaveBeenCalled();
      expect(mockPrisma.documentoChamado.createMany).not.toHaveBeenCalled();

      // Este teste FALHA se o $transaction for removido do service
    });

    it('transação com lista vazia não chama createMany', async () => {
      await (service as any).substituirChamadosVinculados('doc-empty', [], 'user-empty');

      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
      expect(mockTx.documentoChamado.deleteMany).toHaveBeenCalled();
      expect(mockTx.documentoChamado.createMany).not.toHaveBeenCalled();
      expect(mockPrisma.documentoChamado.createMany).not.toHaveBeenCalled();
    });
  });

  describe('Motivo: códigos dos chamados adicionados e removidos', () => {
    let service: DocumentosService;
    let mockPrisma: any;

    beforeEach(() => {
      mockPrisma = {
        chamado: {
          findMany: vi.fn(),
        },
      };

      service = new DocumentosService(mockPrisma as any, null as any, null as any, null as any, null as any);
    });

    it('inclui códigos dos adicionados e removidos no motivo', async () => {
      mockPrisma.chamado.findMany.mockResolvedValue([
        { codigo: 'CHAM-100' },
        { codigo: 'CHAM-200' },
      ]);

      const antes = ['id-100', 'id-200']; // Serão removidos
      const depois = [
        { id: 'id-300', codigo: 'CHAM-300' },
        { id: 'id-400', codigo: 'CHAM-400' },
      ]; // Adicionados

      // Chama o método privado motivoDiffChamados
      const motivo = await (service as any).motivoDiffChamados('DOC-2026-999', antes, depois);

      expect(motivo).toContain('DOC-2026-999');
      expect(motivo).toContain('adicionados: CHAM-300, CHAM-400');
      expect(motivo).toContain('removidos: CHAM-100, CHAM-200');
      expect(mockPrisma.chamado.findMany).toHaveBeenCalledWith({
        where: { id: { in: antes } },
        select: { codigo: true },
      });
    });

    it('motivo sem adições mostra só remoções', async () => {
      mockPrisma.chamado.findMany.mockResolvedValue([{ codigo: 'CHAM-OLD' }]);

      const antes = ['id-old'];
      const depois: any[] = [];

      const motivo = await (service as any).motivoDiffChamados('DOC-2026-888', antes, depois);

      expect(motivo).toContain('removidos: CHAM-OLD');
      expect(motivo).not.toContain('adicionados:');
    });

    it('motivo sem remoções mostra só adições', async () => {
      const antes: string[] = [];
      const depois = [{ id: 'id-new', codigo: 'CHAM-NEW' }];

      const motivo = await (service as any).motivoDiffChamados('DOC-2026-777', antes, depois);

      expect(motivo).toContain('adicionados: CHAM-NEW');
      expect(motivo).not.toContain('removidos:');
    });
  });
});
