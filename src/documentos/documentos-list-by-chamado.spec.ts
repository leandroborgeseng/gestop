import { DocumentoOrigem, DocumentoSituacao, DocumentoTipo } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { JwtPayload } from '../auth/jwt';
import { DocumentosService } from './documentos.service';

function user(partial: Partial<JwtPayload> = {}): JwtPayload {
  return {
    sub: 'user-1',
    email: 'gestor@example.com',
    nome: 'Gestor',
    perfis: ['Gestor'],
    permissoes: ['documentos.visualizar'],
    acessoTodasSecretarias: true,
    ...partial,
  };
}

function documentoPrisma(overrides: Record<string, unknown> = {}) {
  return {
    id: 'doc-1',
    codigo: 'DOC-2026-000001',
    codigoValidacao: 'VALIDA123456',
    tipo: DocumentoTipo.DOCUMENTO_AVULSO,
    situacao: DocumentoSituacao.ASSINATURA_PENDENTE,
    origem: DocumentoOrigem.AVULSO,
    titulo: 'Parecer',
    descricao: null,
    secretaria: { id: 'sec-1', nome: 'Obras', sigla: 'SO' },
    unidade: null,
    chamado: { id: 'ch-1', codigo: 'CH-1', titulo: 'Buraco', status: 'ABERTO', excluidoEm: null },
    chamadosVinculados: [],
    fiscalizacao: null,
    checklistVersao: null,
    checklistVersaoId: null,
    enderecoTexto: null,
    latitude: null,
    longitude: null,
    responsavel: null,
    criadoPor: { id: 'user-1', nome: 'Gestor', email: 'gestor@example.com' },
    conteudoTravadoEm: new Date('2026-10-01T10:00:00Z'),
    pdfOriginalStorageKey: 'docs/original.pdf',
    pdfAssinadoStorageKey: null,
    pdfOriginalSha256: 'abc',
    pdfAssinadoSha256: null,
    respostas: [],
    assinaturas: [
      {
        id: 'ass-1',
        assinanteNome: 'Terceiro',
        assinanteDocumento: '12345678901',
        assinanteEmail: 'ext@example.com',
        qualificacao: 'Autuado',
        qualificacaoOutro: null,
        canal: 'EXTERNA',
        coletadaEm: new Date('2026-10-02T10:00:00Z'),
        invalida: false,
        invalidadaEm: null,
        invalidadaMotivo: null,
        metadata: {},
        assinanteUsuario: null,
        coletadaPor: { id: 'user-1', nome: 'Gestor' },
        evidenciaUrl: null,
        coletadaPorId: 'user-1',
      },
    ],
    assinaturaPedidos: [
      {
        id: 'ped-1',
        status: 'PENDENTE',
        requestedAt: new Date('2026-10-03T10:00:00Z'),
        destinatario: { id: 'user-2', nome: 'João Silva', email: 'joao@example.com' },
        solicitante: { id: 'user-1', nome: 'Gestor' },
      },
    ],
    createdAt: new Date('2026-10-01T10:00:00Z'),
    updatedAt: new Date('2026-10-03T10:00:00Z'),
    metadata: {},
    ...overrides,
  };
}

describe('DocumentosService.listByChamado', () => {
  const prisma = {
    documento: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
  };
  const storage = {};
  let service: DocumentosService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new DocumentosService(prisma as never, storage as never);
  });

  it('devolve signatários internos pendentes (pedidos a Usuario), não a assinatura externa', async () => {
    prisma.documento.count.mockResolvedValue(1);
    prisma.documento.findMany.mockResolvedValue([documentoPrisma()]);

    const result = await service.listByChamado('ch-1', user());

    expect(prisma.documento.findMany).toHaveBeenCalledTimes(1);
    const findManyArg = prisma.documento.findMany.mock.calls[0][0] as {
      where: unknown;
      include: { assinaturaPedidos?: { where?: { status?: string } } };
    };
    expect(findManyArg.include.assinaturaPedidos?.where).toEqual({ status: 'PENDENTE' });
    expect(findManyArg.where).toEqual(
      expect.objectContaining({
        AND: expect.arrayContaining([
          expect.objectContaining({
            OR: [
              { chamadoId: 'ch-1' },
              { chamadosVinculados: { some: { chamadoId: 'ch-1' } } },
            ],
          }),
        ]),
      }),
    );

    expect(result.total).toBe(1);
    expect(result.items[0].signatariosPendentes).toEqual([
      expect.objectContaining({
        id: 'ped-1',
        nome: 'João Silva',
        email: 'joao@example.com',
        solicitanteNome: 'Gestor',
        meu: false,
      }),
    ]);
    expect(result.items[0].signatariosPendentes.map((item: { nome: string }) => item.nome)).not.toContain(
      'Terceiro',
    );
    expect(result.items[0].assinaturas).toEqual([
      expect.objectContaining({ id: 'ass-1', assinanteNome: 'Terceiro' }),
    ]);
  });

  it('documento sem pedidos de assinatura devolve lista vazia e não quebra', async () => {
    prisma.documento.count.mockResolvedValue(1);
    prisma.documento.findMany.mockResolvedValue([documentoPrisma({ assinaturaPedidos: [], assinaturas: [] })]);

    const result = await service.listByChamado('ch-1', user());

    expect(result.items[0].signatariosPendentes).toEqual([]);
    expect(result.items[0].assinaturas).toEqual([]);
  });

  it('respeita a permissão de visualizar documentos relacionados', async () => {
    await expect(service.listByChamado('ch-1', user({ permissoes: [] }))).rejects.toThrow(
      'Sem permissão para visualizar documentos relacionados.',
    );
    expect(prisma.documento.findMany).not.toHaveBeenCalled();
  });
});
