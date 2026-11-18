import { ChamadoStatus, ChecklistItemTipo, ConformidadeStatus } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import type { JwtPayload } from '../auth/jwt';
import { chamadoStatusLabel } from '../chamados/chamados-sla';
import { ChamadosService } from '../chamados/chamados.service';
import { buildDocumentoPdf } from '../documentos/documentos-pdf';
import { DocumentosService } from '../documentos/documentos.service';
import { buildRelatorioExecucaoPdf } from '../documentos/relatorio-execucao-pdf';
import { buildVistoriaRealizadaPdf } from '../fiscalizacoes/vistoria-realizada-pdf';
import {
  CONFORMIDADE_STATUS_LABEL,
  conformidadeStatusLabel,
  resolveRespostaTexto,
} from './checklist-resposta-apresentacao';
import { extrairTextoPdf } from './pdf-texto';

const CODIGO_INTERNO = /\b[A-Z]{2,}(_[A-Z]+)+\b/;

function contemToken(texto: string, token: string) {
  return new RegExp(`\\b${token}\\b`).test(texto);
}

describe('linhas dos PDFs sem enum interno', () => {
  it('cobre tipo, conformidade e status de chamado nos três PDFs', async () => {
    const tipos = Object.values(ChecklistItemTipo);
    const conformidades = Object.values(ConformidadeStatus);
    const statusChamado = Object.values(ChamadoStatus);
    const foraDoMapa = 'FORA_DO_MAPA';
    const conformidadesComFora = [...conformidades, foraDoMapa];

    expect(Object.keys(CONFORMIDADE_STATUS_LABEL).sort()).toEqual([...conformidades].sort());
    for (const conformidade of conformidadesComFora) {
      expect(resolveRespostaTexto({ conformidade })).toBe(conformidadeStatusLabel(conformidade));
      expect(conformidadeStatusLabel(conformidade)).not.toMatch(CODIGO_INTERNO);
    }

    const respostasVistoria = [
      ...tipos.map((tipo, index) => ({
        codigo: `ITEM-${index + 1}`,
        secao: index < 4 ? 'Instalações' : null,
        titulo: `Pergunta fictícia ${index + 1}`,
        categoriaNome: index % 2 === 0 ? 'Estrutura física' : null,
        tipo,
        respostaTexto: `Texto livre ${index + 1}`,
        comentario: null,
        conformidade: conformidadesComFora[index % conformidadesComFora.length],
        naoConformidade: null,
        evidencias: [],
      })),
      ...statusChamado.map((status, index) => ({
        codigo: `NC-${index + 1}`,
        secao: 'Não conformidades',
        titulo: `Item com chamado ${index + 1}`,
        categoriaNome: 'Manutenção',
        tipo: ChecklistItemTipo.BOOLEANO,
        respostaTexto: 'Não',
        comentario: null,
        conformidade: ConformidadeStatus.NAO_CONFORME,
        naoConformidade: {
          status: 'CHAMADO_GERADO',
          motivoBaixa: null,
          chamado: { codigo: `CH-9${String(index + 1).padStart(3, '0')}`, status },
        },
        evidencias: [],
      })),
    ];

    const respostasChecklist = conformidadesComFora.map((conformidade, index) => ({
      codigo: `DOC-${index + 1}`,
      secao: index < 2 ? 'Checklist predial' : null,
      titulo: `Pergunta do checklist ${index + 1}`,
      tipo: tipos[index % tipos.length],
      respostaTexto: `Resposta do checklist ${index + 1}`,
      comentario: null,
      conformidade,
      evidencias: [],
    }));

    const vistoria = await buildVistoriaRealizadaPdf({
      unidadeNome: 'Escola Municipal Fictícia Aurora',
      unidadeCodigoPatrimonial: 'EM-9001',
      secretariaSigla: 'SEDUC',
      secretariaNome: 'Secretaria Municipal de Educação',
      endereco: 'Rua das Acácias, 120',
      bairro: 'Jardim das Flores',
      checklistNome: 'Vistoria predial de exemplo',
      checklistVersao: 3,
      dataHora: '2026-10-05T14:30:00.000Z',
      origemLabel: 'Lançamento de exemplo',
      realizadaPorLabel: 'Ana Lima',
      lancamentoManual: false,
      observacoes: null,
      notaGeral: null,
      respostas: respostasVistoria,
    });

    const documento = await buildDocumentoPdf({
      codigo: 'DOC-9001',
      codigoValidacao: 'VAL9001',
      codigoVerificador: 'VER9001',
      tipoLabel: 'Avulso',
      situacaoLabel: 'Concluído',
      origemLabel: 'Avulso',
      titulo: 'Documento fictício de checklist',
      secretariaLabel: 'SEDUC',
      unidadeLabel: 'EM-9001 Escola Municipal Fictícia Aurora',
      endereco: 'Rua das Acácias, 120',
      chamadoCodigo: 'CH-9001',
      vistoriaLabel: 'Vistoria de exemplo',
      checklistLabel: 'Vistoria predial de exemplo v3',
      responsavelLabel: 'Ana Lima',
      criadoEm: '05/10/2026 11:30',
      geradoEm: '05/10/2026 11:35',
      validationUrl: 'https://example.invalid/validar/DOC-9001',
      incluirAssinaturas: false,
      incluirBlocoAutenticidade: false,
      respostas: respostasChecklist,
    });

    const relatorio = await buildRelatorioExecucaoPdf({
      documentoCodigo: 'DOC-9002',
      chamadoCodigo: 'CH-9002',
      tipoChamadoNome: 'Manutenção predial',
      secretariaLabel: 'SEDUC',
      localLabel: 'EM-9001 Escola Municipal Fictícia Aurora',
      endereco: 'Rua das Acácias, 120',
      statusLabel: 'Concluído',
      responsavelLabel: 'Carlos Mendes',
      equipeLabel: null,
      executadoEm: '05/10/2026 15:00',
      registradoPorLabel: 'Ana Lima',
      origemExecucaoLabel: 'Execução de exemplo',
      relatorio: 'Relatório fictício da execução.',
      checklistNome: 'Checklist da execução',
      checklistVersao: 1,
      respostas: respostasChecklist.map((item) => ({ ...item, naoSeAplica: false })),
      evidenciasGerais: [],
    });

    const textoVistoria = await extrairTextoPdf(vistoria);
    const textoDocumento = await extrairTextoPdf(documento);
    const textoRelatorio = await extrairTextoPdf(relatorio);
    const textos = [textoVistoria, textoDocumento, textoRelatorio];

    for (const texto of textos) {
      expect(texto).not.toMatch(CODIGO_INTERNO);
    }

    expect(textoVistoria).toContain('Categoria: Estrutura física');
    expect(textoVistoria).not.toContain('Tipo:');
    expect(textoVistoria).toContain('Resposta: Texto livre 1');
    expect(textoVistoria).not.toMatch(/Resposta: Texto livre 1 \(/);

    for (const tipo of tipos) {
      for (const texto of textos) {
        expect(contemToken(texto, tipo)).toBe(false);
      }
    }

    for (const conformidade of conformidadesComFora) {
      const rotulo = conformidadeStatusLabel(conformidade);
      expect(textoDocumento).toContain(`Conformidade: ${rotulo}`);
      expect(textoRelatorio).toContain(`Conformidade: ${rotulo}`);
      for (const texto of textos) {
        expect(contemToken(texto, conformidade)).toBe(false);
      }
    }

    for (const status of statusChamado) {
      expect(textoVistoria).toContain(`(${chamadoStatusLabel(status)})`);
      expect(contemToken(textoVistoria, status)).toBe(false);
    }

    expect(textoVistoria).toContain('Não conformidade — chamado');
    expect(textoVistoria).not.toContain("!'");
    expect(textoVistoria).not.toContain('!’');
  });

  it.each(Object.values(ChamadoStatus))(
    'relatório de execução dos dois serviços não vaza o status %s',
    async (status) => {
      const textoChamados = await extrairTextoPdf(await pdfRelatorioPeloChamados(status));
      const textoDocumentos = await extrairTextoPdf(await pdfRelatorioPelosDocumentos(status));
      const rotulo = chamadoStatusLabel(status);

      for (const texto of [textoChamados, textoDocumentos]) {
        expect(texto).toContain(`Status ${rotulo}`);
        expect(texto).not.toMatch(CODIGO_INTERNO);
        expect(contemToken(texto, status)).toBe(false);
        expect(texto).not.toContain("!'");
        expect(texto).not.toContain('!’');
      }
    },
  );
});

const usuarioPdf: JwtPayload = {
  sub: 'u-ficticio',
  email: 'ana.lima@exemplo.invalid',
  nome: 'Ana Lima',
  perfis: [],
  permissoes: [],
};

function pdfRelatorioPeloChamados(status: ChamadoStatus) {
  const prisma = {
    evidencia: { findMany: vi.fn().mockResolvedValue([]) },
    checklistVersao: { findUnique: vi.fn() },
  };
  const service = new ChamadosService(
    prisma as never,
    {} as never,
    { readObjectBuffer: vi.fn() } as never,
    {} as never,
    {} as never,
  );
  return (
    service as unknown as {
      buildRelatorioExecucaoPdfBuffer: (
        chamado: Record<string, unknown>,
        user: JwtPayload,
        opts: Record<string, unknown>,
        documentoCodigo?: string | null,
      ) => Promise<Buffer>;
    }
  ).buildRelatorioExecucaoPdfBuffer(
    {
      id: 'ch-9005',
      codigo: 'CH-9005',
      status,
      secretaria: { nome: 'Secretaria Municipal de Educação', sigla: 'SEDUC' },
      unidade: {
        nome: 'Escola Municipal Fictícia Aurora',
        codigoPatrimonial: 'EM-9001',
        endereco: 'Rua das Acácias, 120',
      },
      enderecoTexto: 'Rua das Acácias, 120',
      tipoChamado: { nome: 'Manutenção predial' },
      responsavel: { nome: 'Carlos Mendes' },
      equipe: { nome: 'Equipe fictícia Norte' },
    },
    usuarioPdf,
    {
      relatorio: 'Relatório fictício da execução.',
      checklistNome: 'Checklist da execução',
      checklistRespostas: [
        {
          codigo: 'ITEM-1',
          titulo: 'Piso da sala',
          tipo: 'TEXTO',
          valorTexto: 'Piso irregular na entrada',
        },
      ],
      origem: 'execucao_conclusao',
      evidenciaIds: [],
      executadoEm: '2026-10-05T15:00:00.000Z',
    },
    'DOC-9005',
  );
}

function pdfRelatorioPelosDocumentos(status: ChamadoStatus) {
  const prisma = {
    chamado: {
      findUnique: vi.fn().mockResolvedValue({
        id: 'ch-9005',
        codigo: 'CH-9005',
        status,
        enderecoTexto: 'Rua das Acácias, 120',
        secretaria: { nome: 'Secretaria Municipal de Educação', sigla: 'SEDUC' },
        unidade: {
          nome: 'Escola Municipal Fictícia Aurora',
          codigoPatrimonial: 'EM-9001',
          endereco: 'Rua das Acácias, 120',
        },
        tipoChamado: { nome: 'Manutenção predial' },
        responsavel: { nome: 'Carlos Mendes' },
        equipe: { nome: 'Equipe fictícia Norte' },
      }),
    },
    historicoStatus: {
      findUnique: vi.fn(),
      findFirst: vi.fn().mockResolvedValue({
        id: 'hist-1',
        createdAt: new Date('2026-10-05T15:00:00.000Z'),
        metadata: {
          tipo: 'execucao_conclusao',
          relatorio: 'Relatório fictício da execução.',
          checklistComplementar: {
            checklistNome: 'Checklist da execução',
            respostas: [
              {
                codigo: 'ITEM-1',
                titulo: 'Piso da sala',
                tipo: 'TEXTO',
                valorTexto: 'Piso irregular na entrada',
              },
            ],
          },
        },
      }),
    },
    evidencia: { findMany: vi.fn().mockResolvedValue([]) },
  };
  const service = new DocumentosService(prisma as never, { readObjectBuffer: vi.fn() } as never);
  return (
    service as unknown as {
      buildRelatorioExecucaoFromDocumento: (doc: {
        codigo: string;
        descricao: string;
        chamadoId: string;
        createdAt: Date;
        metadata: Record<string, unknown>;
        checklistVersao: { versao: number; checklist: { nome: string } };
        responsavel: { nome: string };
        criadoPor: { nome: string };
      }) => Promise<Buffer>;
    }
  ).buildRelatorioExecucaoFromDocumento({
    codigo: 'DOC-9005',
    descricao: 'Execução fictícia',
    chamadoId: 'ch-9005',
    createdAt: new Date('2026-10-05T15:00:00.000Z'),
    metadata: {},
    checklistVersao: { versao: 1, checklist: { nome: 'Checklist da execução' } },
    responsavel: { nome: 'Carlos Mendes' },
    criadoPor: { nome: 'Ana Lima' },
  });
}
