import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ChamadoStatus, DocumentoOrigem, DocumentoSituacao } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { REQUIRED_ANY_PERMISSIONS_KEY } from '../auth/permissions';
import { DocumentosController } from './documentos.controller';
import { DocumentosService } from './documentos.service';

/**
 * Testes do item 256 — exercitam o CÓDIGO REAL (controller + service).
 * Mutações M1–M4 em docs/qa/256-mutacoes.md.
 */

const CHAMADO_VISIVEL = {
  id: 'chamado-1',
  codigo: 'CHAM-001',
  titulo: 'Teste',
  status: ChamadoStatus.ABERTO,
  excluidoEm: null,
};

function userCom(permissoes: string[], extra: Record<string, unknown> = {}) {
  return {
    sub: 'user-1',
    nome: 'Usuario Teste',
    email: 'teste@franca.sp.gov.br',
    perfis: ['Operador'],
    permissoes,
    perfilAtivoId: null,
    secretariaId: null,
    ...extra,
  };
}

function createMockDoc(partial: Record<string, unknown> = {}) {
  return {
    codigo: 'DOC-MOCK',
    codigoValidacao: 'VAL123',
    tipo: 'AVULSO',
    titulo: 'Documento Teste',
    descricao: null,
    pdfOriginalStorageKey: null,
    pdfAssinadoStorageKey: null,
    secretariaId: 'sec-1',
    secretaria: { id: 'sec-1', nome: 'Secretaria', sigla: 'SEC' },
    checklistVersaoId: null,
    checklistVersao: null,
    unidade: null,
    chamado: null,
    fiscalizacao: null,
    chamadosVinculados: [] as unknown[],
    respostas: [] as unknown[],
    assinaturas: [] as unknown[],
    assinaturaPedidos: [] as unknown[],
    createdAt: new Date(),
    updatedAt: new Date(),
    metadata: {},
    unidadeId: null,
    chamadoId: null,
    fiscalizacaoId: null,
    enderecoTexto: null,
    ...partial,
  };
}

function createPrismaMock() {
  const mockTx = {
    documentoChamado: {
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      createMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
  };
  const mockPrisma = {
    $transaction: vi.fn(async (callback: (tx: typeof mockTx) => unknown) => {
      if (typeof callback === 'function') return callback(mockTx);
      return Promise.resolve();
    }),
    documento: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    chamado: {
      findMany: vi.fn(),
    },
    historicoStatus: {
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
      deleteMany: vi.fn(),
      createMany: vi.fn(),
    },
  };
  return { mockPrisma, mockTx };
}

/** Chamados visíveis/vinculáveis — usado no caso feliz e no CONCLUÍDO (M3). */
function stubChamadosVisiveis(mockPrisma: ReturnType<typeof createPrismaMock>['mockPrisma']) {
  mockPrisma.chamado.findMany.mockResolvedValue([CHAMADO_VISIVEL]);
}

function stubDocumentoAtualizado(
  mockPrisma: ReturnType<typeof createPrismaMock>['mockPrisma'],
  doc: ReturnType<typeof createMockDoc>,
) {
  mockPrisma.documento.update.mockResolvedValue(
    createMockDoc({
      ...doc,
      chamadoId: CHAMADO_VISIVEL.id,
      chamadosVinculados: [
        {
          chamadoId: CHAMADO_VISIVEL.id,
          createdAt: new Date(),
          chamado: CHAMADO_VISIVEL,
        },
      ],
    }),
  );
}

describe('documentos-vinculos (item 256) - código real', () => {
  describe('Guard do controller: metadata real do decorator', () => {
    it('decorator @RequireAnyPermissions do updateVinculos inclui documentos.criar_avulso', () => {
      const reflector = new Reflector();
      const permissionsMetadata = reflector.get<string[]>(
        REQUIRED_ANY_PERMISSIONS_KEY,
        DocumentosController.prototype.updateVinculos,
      );

      expect(permissionsMetadata).toBeDefined();
      expect(permissionsMetadata).toContain('documentos.criar_avulso');
      expect(permissionsMetadata).toContain('documentos.editar_vinculo');
      expect(permissionsMetadata).toContain('documentos.administrar');
    });
  });

  describe('Service real: updateVinculos com permissões e situações', () => {
    let service: DocumentosService;
    let mockPrisma: ReturnType<typeof createPrismaMock>['mockPrisma'];

    beforeEach(() => {
      const created = createPrismaMock();
      mockPrisma = created.mockPrisma;
      service = new DocumentosService(mockPrisma as never, null as never);
    });

    it('só criar_avulso em documento RASCUNHO AVULSO alterando só chamados → sucesso', async () => {
      const doc = createMockDoc({
        id: 'doc-1',
        codigo: 'DOC-2026-001',
        origem: DocumentoOrigem.AVULSO,
        situacao: DocumentoSituacao.RASCUNHO,
      });
      mockPrisma.documento.findFirst.mockResolvedValue(doc);
      stubChamadosVisiveis(mockPrisma);
      stubDocumentoAtualizado(mockPrisma, doc);

      const result = await service.updateVinculos(
        'doc-1',
        { chamadoIds: [CHAMADO_VISIVEL.id] },
        userCom(['documentos.criar_avulso']),
      );
      expect(result).toBeDefined();
      expect(result.id).toBe('doc-1');
    });

    it('só criar_avulso em documento CONCLUÍDO → ForbiddenException', async () => {
      const doc = createMockDoc({
        id: 'doc-2',
        codigo: 'DOC-2026-002',
        origem: DocumentoOrigem.AVULSO,
        situacao: DocumentoSituacao.CONCLUIDO,
      });
      mockPrisma.documento.findFirst.mockResolvedValue(doc);
      stubChamadosVisiveis(mockPrisma);
      stubDocumentoAtualizado(mockPrisma, doc);

      const dto = { chamadoIds: [CHAMADO_VISIVEL.id] };
      const user = userCom(['documentos.criar_avulso']);

      await expect(service.updateVinculos('doc-2', dto, user)).rejects.toThrow(ForbiddenException);
      await expect(service.updateVinculos('doc-2', dto, user)).rejects.toThrow(
        'Após a conclusão, só um perfil com permissão de editar vínculo pode alterar os chamados',
      );
    });

    it('editar_vinculo em documento CONCLUÍDO → sucesso', async () => {
      const doc = createMockDoc({
        id: 'doc-3',
        codigo: 'DOC-2026-003',
        origem: DocumentoOrigem.AVULSO,
        situacao: DocumentoSituacao.CONCLUIDO,
      });
      mockPrisma.documento.findFirst.mockResolvedValue(doc);
      stubChamadosVisiveis(mockPrisma);
      stubDocumentoAtualizado(mockPrisma, doc);

      const result = await service.updateVinculos(
        'doc-3',
        { chamadoIds: [CHAMADO_VISIVEL.id] },
        userCom(['documentos.editar_vinculo']),
      );
      expect(result).toBeDefined();
    });

    it('sem permissão → ForbiddenException', async () => {
      mockPrisma.documento.findFirst.mockResolvedValue(
        createMockDoc({
          id: 'doc-4',
          origem: DocumentoOrigem.AVULSO,
          situacao: DocumentoSituacao.RASCUNHO,
        }),
      );

      await expect(
        service.updateVinculos('doc-4', { chamadoIds: [CHAMADO_VISIVEL.id] }, userCom([])),
      ).rejects.toThrow(ForbiddenException);
    });

    it('só criar_avulso tentando mudar unidadeId → ForbiddenException', async () => {
      mockPrisma.documento.findFirst.mockResolvedValue(
        createMockDoc({
          id: 'doc-5',
          origem: DocumentoOrigem.AVULSO,
          situacao: DocumentoSituacao.RASCUNHO,
          unidadeId: 'unid-1',
        }),
      );

      await expect(
        service.updateVinculos(
          'doc-5',
          { unidadeId: 'unid-2', chamadoIds: [] },
          userCom(['documentos.criar_avulso']),
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('origem VISTORIA + só criar_avulso não troca chamados (Forbidden)', async () => {
      mockPrisma.documento.findFirst.mockResolvedValue(
        createMockDoc({
          id: 'doc-vistoria',
          origem: DocumentoOrigem.VISTORIA,
          situacao: DocumentoSituacao.RASCUNHO,
        }),
      );

      await expect(
        service.updateVinculos(
          'doc-vistoria',
          { chamadoIds: [CHAMADO_VISIVEL.id] },
          userCom(['documentos.criar_avulso']),
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('origem CHAMADO_EXECUCAO + só criar_avulso não troca chamados (Forbidden)', async () => {
      mockPrisma.documento.findFirst.mockResolvedValue(
        createMockDoc({
          id: 'doc-exec',
          origem: DocumentoOrigem.CHAMADO_EXECUCAO,
          situacao: DocumentoSituacao.RASCUNHO,
        }),
      );

      await expect(
        service.updateVinculos(
          'doc-exec',
          { chamadoIds: [CHAMADO_VISIVEL.id] },
          userCom(['documentos.criar_avulso']),
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('podeVincularChamadosAvulso é false para VISTORIA mesmo com criar_avulso em RASCUNHO', () => {
      expect(
        (service as any).podeVincularChamadosAvulso(
          { origem: DocumentoOrigem.VISTORIA, situacao: DocumentoSituacao.RASCUNHO },
          userCom(['documentos.criar_avulso']),
        ),
      ).toBe(false);
    });

    it('podeVincularChamadosAvulso é false para CHAMADO_EXECUCAO mesmo com criar_avulso em RASCUNHO', () => {
      expect(
        (service as any).podeVincularChamadosAvulso(
          { origem: DocumentoOrigem.CHAMADO_EXECUCAO, situacao: DocumentoSituacao.RASCUNHO },
          userCom(['documentos.criar_avulso']),
        ),
      ).toBe(false);
    });
  });

  describe('Transação: operações rodam no TX, não no client raiz', () => {
    let service: DocumentosService;
    let mockPrisma: ReturnType<typeof createPrismaMock>['mockPrisma'];
    let mockTx: ReturnType<typeof createPrismaMock>['mockTx'];

    beforeEach(() => {
      const created = createPrismaMock();
      mockPrisma = created.mockPrisma;
      mockTx = created.mockTx;
      service = new DocumentosService(mockPrisma as never, null as never);
    });

    it('deleteMany e createMany rodam no TX, nunca no client raiz', async () => {
      await (service as any).substituirChamadosVinculados('doc-tx', ['cham-a', 'cham-b'], 'user-tx');

      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
      expect(mockPrisma.$transaction).toHaveBeenCalledWith(expect.any(Function));
      expect(mockTx.documentoChamado.deleteMany).toHaveBeenCalledWith({ where: { documentoId: 'doc-tx' } });
      expect(mockTx.documentoChamado.createMany).toHaveBeenCalledWith({
        data: [
          { documentoId: 'doc-tx', chamadoId: 'cham-a', createdById: 'user-tx' },
          { documentoId: 'doc-tx', chamadoId: 'cham-b', createdById: 'user-tx' },
        ],
      });
      expect(mockPrisma.documentoChamado.deleteMany).not.toHaveBeenCalled();
      expect(mockPrisma.documentoChamado.createMany).not.toHaveBeenCalled();
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
    let mockPrisma: ReturnType<typeof createPrismaMock>['mockPrisma'];

    beforeEach(() => {
      const created = createPrismaMock();
      mockPrisma = created.mockPrisma;
      service = new DocumentosService(mockPrisma as never, null as never);
    });

    it('inclui códigos dos adicionados e removidos no motivo', async () => {
      mockPrisma.chamado.findMany.mockResolvedValue([{ codigo: 'CHAM-100' }, { codigo: 'CHAM-200' }]);

      const motivo = await (service as any).motivoDiffChamados(
        'DOC-2026-999',
        ['id-100', 'id-200'],
        [
          { id: 'id-300', codigo: 'CHAM-300' },
          { id: 'id-400', codigo: 'CHAM-400' },
        ],
      );

      expect(motivo).toContain('DOC-2026-999');
      expect(motivo).toContain('adicionados: CHAM-300, CHAM-400');
      expect(motivo).toContain('removidos: CHAM-100, CHAM-200');
    });

    it('motivo sem adições mostra só remoções', async () => {
      mockPrisma.chamado.findMany.mockResolvedValue([{ codigo: 'CHAM-OLD' }]);
      const motivo = await (service as any).motivoDiffChamados('DOC-2026-888', ['id-old'], []);
      expect(motivo).toContain('removidos: CHAM-OLD');
      expect(motivo).not.toContain('adicionados:');
    });

    it('motivo sem remoções mostra só adições', async () => {
      const motivo = await (service as any).motivoDiffChamados('DOC-2026-777', [], [
        { id: 'id-new', codigo: 'CHAM-NEW' },
      ]);
      expect(motivo).toContain('adicionados: CHAM-NEW');
      expect(motivo).not.toContain('removidos:');
    });
  });
});
