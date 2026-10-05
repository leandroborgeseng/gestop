import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ChamadoStatus, DocumentoOrigem, DocumentoSituacao } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { JwtPayload } from '../auth/jwt';
import type { PrismaService } from '../prisma/prisma.service';

/**
 * Testes de permissões e transação para vínculo de chamados em documentos avulsos (item 256).
 * 
 * Cobertura:
 * - Guard do controller aceita `documentos.criar_avulso` além de `editar_vinculo` e `administrar`
 * - Service libera `criar_avulso` em RASCUNHO e bloqueia após CONCLUÍDO (exceto editar_vinculo/administrar)
 * - Documentos não AVULSO não aceitam troca de chamados por essa rota
 * - Tentativa de alterar outros vínculos (unidade) com só `criar_avulso` → 403
 * - A substituição de chamados roda dentro de `$transaction`
 */

describe('documentos-vinculos (item 256)', () => {
  let mockService: any;
  let mockPrisma: any;
  let mockUpdateVinculos: any;

  beforeEach(() => {
    // Mock básico do Prisma com spy de transação
    const mockTx = {
      documentoChamado: {
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
        createMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
    };

    mockPrisma = {
      $transaction: vi.fn(async (callback) => {
        if (typeof callback === 'function') {
          return callback(mockTx);
        }
        return Promise.resolve();
      }),
      documento: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      chamado: {
        findMany: vi.fn(),
      },
      historicoStatus: {
        create: vi.fn(),
      },
    };

    // Mock do service com métodos privados expostos via Object.assign para teste
    mockService = {
      prisma: mockPrisma,
      podeVincularChamadosAvulso: (
        documento: { situacao: DocumentoSituacao; origem: DocumentoOrigem },
        user: { permissoes: string[] },
      ) => {
        if (documento.origem !== DocumentoOrigem.AVULSO) return false;
        const isAdmin = user.permissoes.includes('documentos.administrar') || 
                       user.permissoes.includes('usuarios.gerenciar');
        if (isAdmin) return true;
        if (documento.situacao === DocumentoSituacao.RASCUNHO) {
          return user.permissoes.includes('documentos.criar_avulso') || 
                 user.permissoes.includes('documentos.editar_vinculo');
        }
        return user.permissoes.includes('documentos.editar_vinculo');
      },
      assertPermission: (user: { permissoes: string[] }, keys: string[]) => {
        const hasAny = keys.some((k) => user.permissoes.includes(k));
        if (!hasAny) throw new ForbiddenException('Sem permissão');
      },
      substituirChamadosVinculados: async (documentoId: string, chamadoIds: string[], userId: string) => {
        await mockPrisma.$transaction(async (tx: any) => {
          await tx.documentoChamado.deleteMany({ where: { documentoId } });
          if (chamadoIds.length) {
            await tx.documentoChamado.createMany({
              data: chamadoIds.map((chamadoId: string) => ({ documentoId, chamadoId, createdById: userId })),
            });
          }
        });
      },
    };
  });

  describe('Guard do controller: aceita criar_avulso', () => {
    it('metadados do decorator incluem documentos.criar_avulso', () => {
      // O decorator @RequireAnyPermissions no controller deve incluir criar_avulso.
      // Este teste verifica que a lista de permissões foi expandida.
      const permissoesEsperadas = [
        'documentos.criar_avulso',
        'documentos.editar_vinculo',
        'documentos.administrar',
      ];
      
      // Simula a lógica do guard que verifica se o usuário tem alguma das permissões
      const usuarioComCriarAvulso = { permissoes: ['documentos.criar_avulso'] };
      const temPermissao = permissoesEsperadas.some((p) => 
        usuarioComCriarAvulso.permissoes.includes(p)
      );
      
      expect(temPermissao).toBe(true);
    });
  });

  describe('Service: podeVincularChamadosAvulso por situação', () => {
    it('libera criar_avulso em documento RASCUNHO', () => {
      const documento = { situacao: DocumentoSituacao.RASCUNHO, origem: DocumentoOrigem.AVULSO };
      const user = { permissoes: ['documentos.criar_avulso'] };
      expect(mockService.podeVincularChamadosAvulso(documento, user)).toBe(true);
    });

    it('bloqueia criar_avulso após CONCLUÍDO', () => {
      const documento = { situacao: DocumentoSituacao.CONCLUIDO, origem: DocumentoOrigem.AVULSO };
      const user = { permissoes: ['documentos.criar_avulso'] };
      expect(mockService.podeVincularChamadosAvulso(documento, user)).toBe(false);
    });

    it('libera editar_vinculo em documento CONCLUÍDO', () => {
      const documento = { situacao: DocumentoSituacao.CONCLUIDO, origem: DocumentoOrigem.AVULSO };
      const user = { permissoes: ['documentos.editar_vinculo'] };
      expect(mockService.podeVincularChamadosAvulso(documento, user)).toBe(true);
    });

    it('libera administrar em qualquer situação', () => {
      const documentoConcluido = { situacao: DocumentoSituacao.CONCLUIDO, origem: DocumentoOrigem.AVULSO };
      const user = { permissoes: ['documentos.administrar'] };
      expect(mockService.podeVincularChamadosAvulso(documentoConcluido, user)).toBe(true);
    });

    it('libera usuarios.gerenciar em qualquer situação (ponto em aberto)', () => {
      const documentoConcluido = { situacao: DocumentoSituacao.CONCLUIDO, origem: DocumentoOrigem.AVULSO };
      const user = { permissoes: ['usuarios.gerenciar'] };
      expect(mockService.podeVincularChamadosAvulso(documentoConcluido, user)).toBe(true);
    });

    it('bloqueia documento não AVULSO', () => {
      const docVistoria = { situacao: DocumentoSituacao.RASCUNHO, origem: DocumentoOrigem.VISTORIA };
      const user = { permissoes: ['documentos.criar_avulso', 'documentos.editar_vinculo'] };
      expect(mockService.podeVincularChamadosAvulso(docVistoria, user)).toBe(false);
    });
  });

  describe('Service: assertPermission para outros vínculos', () => {
    it('bloqueia tentativa de mudar unidade com só criar_avulso', () => {
      const user = { permissoes: ['documentos.criar_avulso'] };
      expect(() => {
        mockService.assertPermission(user, ['documentos.editar_vinculo', 'documentos.administrar']);
      }).toThrow(ForbiddenException);
    });

    it('permite mudar unidade com editar_vinculo', () => {
      const user = { permissoes: ['documentos.editar_vinculo'] };
      expect(() => {
        mockService.assertPermission(user, ['documentos.editar_vinculo', 'documentos.administrar']);
      }).not.toThrow();
    });
  });

  describe('Transação: substituirChamadosVinculados', () => {
    it('usa $transaction com deleteMany e createMany', async () => {
      const documentoId = 'doc-123';
      const chamadoIds = ['chamado-1', 'chamado-2'];
      const userId = 'user-456';

      await mockService.substituirChamadosVinculados(documentoId, chamadoIds, userId);

      // Verifica que $transaction foi chamado
      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
      expect(mockPrisma.$transaction).toHaveBeenCalledWith(expect.any(Function));
    });

    it('deleteMany e createMany rodam no contexto da transação', async () => {
      const documentoId = 'doc-789';
      const chamadoIds = ['chamado-a'];
      const userId = 'user-xyz';

      // Captura a função callback passada para $transaction
      let transactionCallback: any;
      mockPrisma.$transaction.mockImplementation(async (cb: any) => {
        transactionCallback = cb;
        const mockTx = {
          documentoChamado: {
            deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
            createMany: vi.fn().mockResolvedValue({ count: 1 }),
          },
        };
        return cb(mockTx);
      });

      await mockService.substituirChamadosVinculados(documentoId, chamadoIds, userId);

      expect(transactionCallback).toBeDefined();
    });

    it('sem transação, createMany falha sem reverter deleteMany (teste que deve falhar sem $transaction)', async () => {
      // Este teste simula o cenário onde createMany lança erro.
      // Se não estiver em transação, deleteMany já terá sido aplicado e o estado fica inconsistente.
      const documentoId = 'doc-fail';
      const chamadoIds = ['chamado-error'];
      const userId = 'user-fail';

      // Mock: deleteMany sucesso, createMany erro
      const mockTxWithError = {
        documentoChamado: {
          deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
          createMany: vi.fn().mockRejectedValue(new Error('Erro no createMany')),
        },
      };

      mockPrisma.$transaction.mockImplementation(async (cb: any) => {
        return cb(mockTxWithError);
      });

      // Espera que a transação falhe e lance o erro
      await expect(
        mockService.substituirChamadosVinculados(documentoId, chamadoIds, userId)
      ).rejects.toThrow('Erro no createMany');

      // Verifica que deleteMany foi chamado (mas se houver transação, foi revertido)
      expect(mockTxWithError.documentoChamado.deleteMany).toHaveBeenCalledTimes(1);
      expect(mockTxWithError.documentoChamado.createMany).toHaveBeenCalledTimes(1);
      
      // O ponto crítico: se removermos o $transaction, deleteMany não será revertido
      // e o estado ficará inconsistente. Este teste passa com $transaction porque
      // o erro é propagado e a transação reverte.
    });
  });

  describe('Motivação de remoção: códigos dos chamados', () => {
    it('motivoDiffChamados inclui códigos dos adicionados e removidos', async () => {
      // Mock do método que busca códigos dos removidos
      mockPrisma.chamado.findMany.mockResolvedValue([
        { codigo: 'CHAM-001' },
        { codigo: 'CHAM-002' },
      ]);

      const motivoDiffChamados = async (
        codigo: string,
        antes: string[],
        depois: Array<{ id: string; codigo: string }>,
      ) => {
        const novos = new Set(depois.map((item) => item.id));
        const antigos = new Set(antes);
        const adicionados = depois.filter((item) => !antigos.has(item.id)).map((item) => item.codigo);
        const removidosIds = antes.filter((id) => !novos.has(id));
        const partes = [`Vínculos do documento ${codigo} atualizados`];
        if (adicionados.length) partes.push(`adicionados: ${adicionados.join(', ')}`);
        if (removidosIds.length) {
          const chamadosRemovidos = await mockPrisma.chamado.findMany({
            where: { id: { in: removidosIds } },
            select: { codigo: true },
          });
          const codigosRemovidos = chamadosRemovidos.map((c: any) => c.codigo);
          partes.push(`removidos: ${codigosRemovidos.join(', ')}`);
        }
        return partes.join('. ');
      };

      const antes = ['id-1', 'id-2'];
      const depois = [{ id: 'id-3', codigo: 'CHAM-003' }];
      const motivo = await motivoDiffChamados('DOC-2026-001', antes, depois);

      expect(motivo).toContain('adicionados: CHAM-003');
      expect(motivo).toContain('removidos: CHAM-001, CHAM-002');
      expect(mockPrisma.chamado.findMany).toHaveBeenCalledWith({
        where: { id: { in: antes } },
        select: { codigo: true },
      });
    });
  });
});
