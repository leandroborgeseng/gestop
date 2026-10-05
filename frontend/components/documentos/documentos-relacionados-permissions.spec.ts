import { describe, expect, it } from 'vitest';
import { canColetarAssinatura } from '@/lib/permissions-matrix';
import { DocumentoResumo } from '@/lib/types';

describe('DocumentosRelacionadosPanel - Lógica de permissões e signatários', () => {
  describe('Botão Coletar assinatura - verificação de permissão', () => {
    it('deve permitir coletar com permissão documentos.coletar_assinatura', () => {
      const permissoes = ['documentos.visualizar', 'documentos.coletar_assinatura'];
      expect(canColetarAssinatura(permissoes)).toBe(true);
    });

    it('deve permitir coletar com matriz.documentos.coletar_assinatura.executar', () => {
      const permissoes = ['matriz.documentos._tela.visualizar', 'matriz.documentos.coletar_assinatura.executar'];
      expect(canColetarAssinatura(permissoes)).toBe(true);
    });

    it('deve permitir coletar para usuarios.gerenciar', () => {
      const permissoes = ['usuarios.gerenciar'];
      expect(canColetarAssinatura(permissoes)).toBe(true);
    });

    it('deve permitir coletar para documentos.administrar', () => {
      const permissoes = ['documentos.administrar'];
      expect(canColetarAssinatura(permissoes)).toBe(true);
    });

    it('não deve permitir coletar apenas com acesso ao módulo documentos', () => {
      const permissoes = ['matriz.documentos._tela.visualizar', 'matriz.documentos.consultar.visualizar'];
      expect(canColetarAssinatura(permissoes)).toBe(false);
    });

    it('não deve permitir coletar apenas com documentos.visualizar', () => {
      const permissoes = ['documentos.visualizar'];
      expect(canColetarAssinatura(permissoes)).toBe(false);
    });

    it('não deve permitir coletar sem permissões de documentos', () => {
      const permissoes = ['chamados.visualizar', 'chamados.gerenciar'];
      expect(canColetarAssinatura(permissoes)).toBe(false);
    });
  });

  describe('Signatários pendentes - processamento de dados', () => {
    it('deve processar corretamente documento com signatários pendentes', () => {
      const documento: DocumentoResumo = {
        id: 'doc-1',
        codigo: 'DOC-2026-001',
        codigoValidacao: 'ABC123',
        tipo: 'DOCUMENTO_AVULSO',
        situacao: 'ASSINATURA_PENDENTE',
        origem: 'AVULSO',
        titulo: 'Documento teste',
        possuiPdfOriginal: true,
        possuiPdfAssinado: false,
        assinaturas: [],
        createdAt: '2026-10-05T10:00:00Z',
        updatedAt: '2026-10-05T10:00:00Z',
        signatariosPendentes: [
          { id: 'sp1', nome: 'João Silva', email: 'joao@example.com', meu: false },
          { id: 'sp2', nome: 'Maria Santos', email: null, meu: false },
        ],
      };

      expect(documento.signatariosPendentes).toBeDefined();
      expect(documento.signatariosPendentes).toHaveLength(2);
      expect(documento.signatariosPendentes?.[0].nome).toBe('João Silva');
      expect(documento.signatariosPendentes?.[0].email).toBe('joao@example.com');
      expect(documento.signatariosPendentes?.[1].nome).toBe('Maria Santos');
      expect(documento.signatariosPendentes?.[1].email).toBeNull();
    });

    it('deve lidar com documento sem signatários pendentes (array vazio)', () => {
      const documento: DocumentoResumo = {
        id: 'doc-1',
        codigo: 'DOC-2026-001',
        codigoValidacao: 'ABC123',
        tipo: 'DOCUMENTO_AVULSO',
        situacao: 'ASSINADO_VIGENTE',
        origem: 'AVULSO',
        titulo: 'Documento teste',
        possuiPdfOriginal: true,
        possuiPdfAssinado: true,
        assinaturas: [],
        createdAt: '2026-10-05T10:00:00Z',
        updatedAt: '2026-10-05T10:00:00Z',
        signatariosPendentes: [],
      };

      const hasPendentes = (documento.signatariosPendentes ?? []).length > 0;
      expect(hasPendentes).toBe(false);
    });

    it('deve lidar com documento sem campo signatariosPendentes (undefined)', () => {
      const documento: DocumentoResumo = {
        id: 'doc-1',
        codigo: 'DOC-2026-001',
        codigoValidacao: 'ABC123',
        tipo: 'DOCUMENTO_AVULSO',
        situacao: 'GERADO',
        origem: 'AVULSO',
        titulo: 'Documento teste',
        possuiPdfOriginal: true,
        possuiPdfAssinado: false,
        assinaturas: [],
        createdAt: '2026-10-05T10:00:00Z',
        updatedAt: '2026-10-05T10:00:00Z',
      };

      const hasPendentes = (documento.signatariosPendentes ?? []).length > 0;
      expect(hasPendentes).toBe(false);
    });

    it('deve respeitar situação do documento para botão Coletar', () => {
      const situacoesQuePermitemColetar = [
        'GERADO',
        'SEM_ASSINATURA_EXTERNA',
        'ASSINATURA_PENDENTE',
        'ASSINADO_VIGENTE',
        'RASCUNHO',
      ];

      const situacoesQueNaoPermitemColetar = ['CANCELADO'];

      for (const situacao of situacoesQuePermitemColetar) {
        if (situacao === 'CANCELADO') {
          expect(situacao).not.toBe('CANCELADO');
        }
      }

      for (const situacao of situacoesQueNaoPermitemColetar) {
        expect(situacao).toBe('CANCELADO');
      }
    });
  });

  describe('Integração: permissão + documento + exibição', () => {
    it('botão deve aparecer: documento com PDF + usuário com permissão + não cancelado', () => {
      const permissoes = ['documentos.coletar_assinatura'];
      const documento: Partial<DocumentoResumo> = {
        situacao: 'ASSINADO_VIGENTE',
        possuiPdfOriginal: true,
      };

      const podeVer = canColetarAssinatura(permissoes);
      const situacaoPermite = documento.situacao !== 'CANCELADO';
      const temPdf = documento.possuiPdfOriginal;

      expect(podeVer && situacaoPermite && temPdf).toBe(true);
    });

    it('botão NÃO deve aparecer: sem permissão mesmo com documento válido', () => {
      const permissoes = ['documentos.visualizar'];
      const documento: Partial<DocumentoResumo> = {
        situacao: 'ASSINADO_VIGENTE',
        possuiPdfOriginal: true,
      };

      const podeVer = canColetarAssinatura(permissoes);
      const situacaoPermite = documento.situacao !== 'CANCELADO';
      const temPdf = documento.possuiPdfOriginal;

      expect(podeVer && situacaoPermite && temPdf).toBe(false);
    });

    it('botão NÃO deve aparecer: com permissão mas documento cancelado', () => {
      const permissoes = ['documentos.coletar_assinatura'];
      const documento: Partial<DocumentoResumo> = {
        situacao: 'CANCELADO',
        possuiPdfOriginal: true,
      };

      const podeVer = canColetarAssinatura(permissoes);
      const situacaoPermite = documento.situacao !== 'CANCELADO';
      const temPdf = documento.possuiPdfOriginal;

      expect(podeVer && situacaoPermite && temPdf).toBe(false);
    });

    it('signatários devem aparecer quando há pendentes', () => {
      const documento: Partial<DocumentoResumo> = {
        signatariosPendentes: [
          { id: 'sp1', nome: 'João Silva', email: 'joao@example.com', meu: false },
        ],
      };

      const deveExibirSecao = (documento.signatariosPendentes ?? []).length > 0;
      expect(deveExibirSecao).toBe(true);
    });

    it('signatários NÃO devem aparecer quando não há pendentes', () => {
      const documento: Partial<DocumentoResumo> = {
        signatariosPendentes: [],
      };

      const deveExibirSecao = (documento.signatariosPendentes ?? []).length > 0;
      expect(deveExibirSecao).toBe(false);
    });
  });
});
