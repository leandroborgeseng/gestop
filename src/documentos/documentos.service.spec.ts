import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DocumentoOrigem, DocumentoSituacao, DocumentoTipo } from '@prisma/client';
import { DocumentosService } from './documentos.service';
import { extrairTextoPdf } from '../checklists/pdf-texto';

function makeService() {
  const prisma = {
    chamado: {
      findUnique: vi.fn(),
    },
    historicoStatus: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
    },
    evidencia: {
      findMany: vi.fn().mockResolvedValue([]),
    },
  };
  const storage = {
    readObjectBuffer: vi.fn(),
  };
  const service = new DocumentosService(prisma as never, storage as never);
  return { service, prisma };
}

const respostasAmostra = [
  {
    codigo: 'ZZ-COD-001',
    titulo: 'Estado das paredes internas',
    tipo: 'MULTIPLA_ESCOLHA',
    valorTexto: '["Bom","Ótimo"]',
  },
  {
    codigo: 'ZZ-COD-002',
    titulo: 'Estado do piso',
    tipo: 'MULTIPLA_ESCOLHA',
    valorTexto: 'Regular',
  },
  {
    codigo: 'ZZ-COD-004',
    titulo: 'Observações gerais adicionais',
    tipo: 'TEXTO',
    valorTexto: 'Escola bem mantida no geral.',
  },
];

describe('DocumentosService apresenta respostas formatadas', () => {
  it('P14 formatRespostaTexto e respostaValorTexto: JSON, única e texto livre', () => {
    const { service } = makeService();
    const format = (service as unknown as { formatRespostaTexto: (r: { valorTexto: string }) => string })
      .formatRespostaTexto.bind(service);
    const valor = (service as unknown as { respostaValorTexto: (r: { valorTexto: string }) => string | null })
      .respostaValorTexto.bind(service);

    expect(format({ valorTexto: '["Bom","Ótimo"]' })).toBe('Bom, Ótimo');
    expect(valor({ valorTexto: '["Bom","Ótimo"]' })).toBe('Bom, Ótimo');
    expect(format({ valorTexto: 'Regular' })).toBe('Regular');
    expect(valor({ valorTexto: 'Regular' })).toBe('Regular');
    expect(format({ valorTexto: 'Escola bem mantida no geral.' })).toBe('Escola bem mantida no geral.');
    expect(valor({ valorTexto: 'Escola bem mantida no geral.' })).toBe('Escola bem mantida no geral.');
  });

  it('P13 monta o relatório de execução a partir do documento com valor formatado', async () => {
    const { service, prisma } = makeService();
    prisma.chamado.findUnique.mockResolvedValue({
      id: 'ch-1',
      codigo: 'CH-1',
      status: 'CONCLUIDO',
      enderecoTexto: 'Rua 1',
      secretaria: { nome: 'Educação', sigla: 'SEDUC' },
      unidade: { nome: 'Escola', codigoPatrimonial: 'EM-001', endereco: 'Rua 1' },
      tipoChamado: { nome: 'Manutenção' },
      responsavel: { nome: 'João' },
      equipe: { nome: 'Equipe' },
    });
    prisma.historicoStatus.findFirst.mockResolvedValue({
      id: 'hist-1',
      createdAt: new Date('2026-10-05T14:30:00.000Z'),
      metadata: {
        tipo: 'execucao_conclusao',
        relatorio: 'Feito',
        checklistComplementar: {
          checklistNome: 'Checklist',
          respostas: respostasAmostra,
        },
      },
    });

    const documento = {
      id: 'doc-1',
      codigo: 'DOC-1',
      descricao: 'Execução',
      chamadoId: 'ch-1',
      createdAt: new Date('2026-10-05T14:30:00.000Z'),
      metadata: {},
      checklistVersao: { versao: 1, checklist: { nome: 'Checklist' } },
    };

    const buffer = await (
      service as unknown as {
        buildRelatorioExecucaoFromDocumento: (doc: typeof documento) => Promise<Buffer>;
      }
    ).buildRelatorioExecucaoFromDocumento(documento);

    const texto = await extrairTextoPdf(buffer);
    expect(texto).toContain('Bom, Ótimo');
    expect(texto).toContain('Regular');
    expect(texto).toContain('Escola bem mantida no geral.');
    expect(texto).not.toContain('["');
  });

  it('monta o PDF de documento avulso com valor formatado', async () => {
    const { service } = makeService();
    const documento = {
      id: 'doc-avulso',
      codigo: 'DOC-AV',
      codigoValidacao: 'VAL',
      tipo: DocumentoTipo.DOCUMENTO_AVULSO,
      situacao: DocumentoSituacao.GERADO,
      origem: DocumentoOrigem.AVULSO,
      titulo: 'Documento avulso',
      createdAt: new Date('2026-10-05T14:30:00.000Z'),
      enderecoTexto: null,
      pdfOriginalSha256: null,
      metadata: {},
      secretaria: { nome: 'Educação', sigla: 'SEDUC' },
      unidade: null,
      chamado: null,
      chamadosVinculados: [],
      fiscalizacao: null,
      checklistVersao: { id: 'v1', versao: 1, checklist: { nome: 'Checklist' } },
      responsavel: { nome: 'João' },
      respostas: respostasAmostra.map((item, index) => ({
        itemId: `item-${index}`,
        valorTexto: item.valorTexto,
        valorNumero: null,
        valorBooleano: null,
        comentario: null,
        conformidade: null,
        item: {
          codigo: item.codigo,
          secao: index < 2 ? 'Infraestrutura básica' : null,
          titulo: item.titulo,
          tipo: item.tipo,
          ordem: index + 1,
        },
      })),
      assinaturas: [],
    };

    const buffer = await (
      service as unknown as {
        buildDocumentoPdfBuffer: (
          doc: typeof documento,
          options: { incluirAssinaturas: boolean; incluirBlocoAutenticidade?: boolean },
        ) => Promise<Buffer>;
      }
    ).buildDocumentoPdfBuffer(documento, { incluirAssinaturas: false, incluirBlocoAutenticidade: false });

    const texto = await extrairTextoPdf(buffer);
    expect(texto).toContain('Bom, Ótimo');
    expect(texto).toContain('Regular');
    expect(texto).toContain('Escola bem mantida no geral.');
    expect(texto).not.toContain('["');
  });

  it('não usa valorTexto cru nos formatadores do serviço (P13/P14)', () => {
    const src = readFileSync(resolve('src/documentos/documentos.service.ts'), 'utf8');
    expect(src).toContain('const respostaTexto = resolveRespostaTexto({');
    expect(src).toContain('return resolveRespostaTexto(resposta);');
    expect(src).not.toContain('item.valorTexto.trim()) || resolveRespostaTexto');
    expect(src).not.toContain('resposta.valorTexto?.trim() || resolveRespostaTexto(resposta)');
  });
});
