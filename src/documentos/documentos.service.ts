import { formatSecretariaLabel } from '../common/format-secretaria';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  AuditAction,
  ChecklistFinalidade,
  ChecklistVersaoStatus,
  ConformidadeStatus,
  ChamadoStatus,
  ChamadoTarefaStatus,
  DocumentoAssinaturaPedidoStatus,
  DocumentoOrigem,
  DocumentoSituacao,
  DocumentoTipo,
  Prisma,
  type DocumentoResposta,
} from '@prisma/client';
import { JwtPayload } from '../auth/jwt';
import { verifyPassword } from '../auth/password';
import { hasAnyPermission, isAdministradorSistema } from '../auth/permissions';
import { resolveChamadoSecretariaFilter, resolveDirectSecretariaFilter } from '../auth/secretaria-scope';
import { validateChecklistResponses } from '../domain/checklist-response.rules';
import { resolveMeusChamadosTimelineCaps } from '../chamados/meus-chamados-timeline.permissions';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { shrinkImageForPdf } from '../storage/pdf-image';
import {
  buildDocumentoPdf,
  type DocumentoPdfAssinatura,
  type DocumentoPdfResposta,
} from './documentos-pdf';
import { appendAssinaturasAoPdfOriginal } from './documentos-pdf-assinado';
import {
  buildPublicValidationUrl,
  generateCodigoValidacao,
  generateCodigoVerificador,
  displayAssinanteCpf,
  displayAssinanteEmail,
  sha256Buffer,
  verifyCodigoVerificador,
} from './documentos-validation';
import { buildRelatorioExecucaoPdf } from './relatorio-execucao-pdf';
import { apresentarValorTexto } from '../checklists/checklist-item.rules';
import { tarefaAtrasada } from '../chamados/chamado-tarefa.regras';
import { extractStorageKeyFromUrl } from '../storage/storage-url';
import { isPdfRenderableImage } from '../fiscalizacoes/vistoria-realizada-pdf';
import {
  AssinarDocumentoInternoDto,
  CancelarDocumentoDto,
  ColetarAssinaturaDto,
  CreateDocumentoAvulsoDto,
  DisponibilizarAssinaturaInternaDto,
  DocumentoRespostaItemDto,
  ListDocumentosQueryDto,
  RecusarAssinaturaInternaDto,
  SalvarDocumentoRespostasDto,
  UpdateDocumentoVinculosDto,
} from './documentos.dto';
import {
  hasDocumentosModuloAccess,
  hasDocumentosRelacionadosAccess,
} from './documentos.permissions';

const DOCUMENTO_INCLUDE = {
  secretaria: { select: { id: true, nome: true, sigla: true } },
  unidade: { select: { id: true, nome: true, codigoPatrimonial: true, endereco: true } },
  chamado: { select: { id: true, codigo: true, titulo: true, status: true, excluidoEm: true } },
  chamadosVinculados: {
    orderBy: { createdAt: 'asc' as const },
    select: {
      chamadoId: true,
      createdAt: true,
      chamado: { select: { id: true, codigo: true, titulo: true, status: true, excluidoEm: true } },
    },
  },
  fiscalizacao: {
    select: {
      id: true,
      status: true,
      concluidaEm: true,
      unidade: { select: { nome: true, codigoPatrimonial: true } },
    },
  },
  checklistVersao: {
    select: {
      id: true,
      versao: true,
      checklist: { select: { id: true, nome: true } },
    },
  },
  responsavel: { select: { id: true, nome: true, email: true } },
  criadoPor: { select: { id: true, nome: true, email: true } },
  respostas: {
    orderBy: { createdAt: 'asc' as const },
    include: {
      item: {
        select: {
          id: true,
          codigo: true,
          secao: true,
          titulo: true,
          tipo: true,
          ordem: true,
          obrigatorio: true,
          exigeEvidencia: true,
          opcoes: true,
        },
      },
    },
  },
  assinaturas: {
    orderBy: { coletadaEm: 'desc' as const },
    include: {
      assinanteUsuario: { select: { id: true, nome: true } },
      coletadaPor: { select: { id: true, nome: true } },
    },
  },
  assinaturaPedidos: {
    where: { status: 'PENDENTE' as const },
    orderBy: { requestedAt: 'asc' as const },
    select: {
      id: true,
      status: true,
      requestedAt: true,
      destinatario: { select: { id: true, nome: true, email: true } },
      solicitante: { select: { id: true, nome: true } },
    },
  },
} satisfies Prisma.DocumentoInclude;

type DocumentoLoaded = Prisma.DocumentoGetPayload<{ include: typeof DOCUMENTO_INCLUDE }>;

type EvidenciaStored = {
  storageKey: string;
  url: string;
  mimeType: string;
  checksum?: string;
  tamanhoBytes?: number;
};

const TIPO_LABELS: Record<DocumentoTipo, string> = {
  RELATORIO_VISTORIA: 'Relatório de vistoria',
  CHECKLIST_PREENCHIDO: 'Checklist preenchido',
  RELATORIO_EXECUCAO: 'Relatório de execução',
  RELATORIO_FOTOGRAFICO: 'Relatório fotográfico',
  NOTIFICACAO: 'Notificação',
  AUTO: 'Auto',
  TERMO: 'Termo',
  TERMO_CIENCIA: 'Termo de ciência',
  DOCUMENTO_AVULSO: 'Documento avulso',
  OUTRO: 'Outro',
};

const SITUACAO_LABELS: Record<DocumentoSituacao, string> = {
  RASCUNHO: 'Rascunho',
  GERADO: 'Gerado',
  SEM_ASSINATURA_EXTERNA: 'Sem assinatura externa',
  ASSINATURA_PENDENTE: 'Assinatura pendente',
  ASSINADO_VIGENTE: 'Assinado vigente',
  CANCELADO: 'Cancelado',
  SUBSTITUIDO: 'Substituído',
  INVALIDO: 'Inválido',
};

const ORIGEM_LABELS: Record<DocumentoOrigem, string> = {
  VISTORIA: 'Vistoria',
  CHAMADO_EXECUCAO: 'Execução de chamado',
  AVULSO: 'Avulso',
  SISTEMA: 'Sistema',
};

@Injectable()
export class DocumentosService {
  private readonly logger = new Logger(DocumentosService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
  ) {}

  async list(query: ListDocumentosQueryDto, user: JwtPayload) {
    this.assertCanVisualizarModulo(user);
    const limit = Math.min(Math.max(Number(query.limit) || 50, 1), 200);
    const offset = Math.max(Number(query.offset) || 0, 0);
    const where = this.buildWhere(query, user);

    const [total, items] = await Promise.all([
      this.prisma.documento.count({ where }),
      this.prisma.documento.findMany({
        where,
        include: DOCUMENTO_INCLUDE,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
    ]);

    return {
      total,
      items: items.map((item) => this.serialize(item, { usuarioId: user.sub })),
    };
  }

  async getById(id: string, user: JwtPayload) {
    const pedidoDoUsuario = await this.prisma.documentoAssinaturaPedido.findFirst({
      where: { documentoId: id, destinatarioId: user.sub },
      select: { id: true },
    });
    const modulo =
      isAdministradorSistema(user) ||
      hasDocumentosModuloAccess(user.permissoes) ||
      hasAnyPermission(user, ['documentos.visualizar', 'documentos.administrar']);
    const documento = await this.prisma.documento.findFirst({
      where: { id },
      include: DOCUMENTO_INCLUDE,
    });
    if (!documento) throw new NotFoundException('Documento não encontrado.');
    const elaborador = documento.criadoPorId === user.sub || documento.responsavelId === user.sub;
    const noEscopo = modulo
      ? Boolean(
          await this.prisma.documento.findFirst({
            where: { id, ...this.scopeFilter(user) },
            select: { id: true },
          }),
        )
      : false;
    if (!noEscopo && !pedidoDoUsuario && !elaborador) {
      throw new NotFoundException('Documento não encontrado.');
    }

    const historico = await this.prisma.historicoStatus.findMany({
      where: { entidadeTipo: 'DOCUMENTO', entidadeId: id },
      orderBy: { createdAt: 'asc' },
      include: { alteradoPor: { select: { id: true, nome: true } } },
    });

    const podeVerAssinaturasAnteriores = this.canSeeAssinaturasAnteriores(user);
    const anteriores = (documento.assinaturas ?? [])
      .filter((item) => item.invalida)
      .sort((a, b) => {
        const aEm = a.invalidadaEm?.getTime() ?? a.coletadaEm.getTime();
        const bEm = b.invalidadaEm?.getTime() ?? b.coletadaEm.getTime();
        return bEm - aEm;
      });

    const checklistItens = documento.checklistVersaoId
      ? await this.prisma.checklistItem.findMany({
          where: { checklistVersaoId: documento.checklistVersaoId, ativo: true },
          orderBy: { ordem: 'asc' },
          select: {
            id: true,
            ordem: true,
            codigo: true,
            secao: true,
            titulo: true,
            descricao: true,
            tipo: true,
            obrigatorio: true,
            geraNaoConformidade: true,
            exigeEvidencia: true,
            opcoes: true,
            categoriaVistoriaId: true,
            ativo: true,
          },
        })
      : [];

    return {
      ...this.serialize(documento, { fullPii: true, usuarioId: user.sub }),
      podeEditarChamados:
        documento.origem === DocumentoOrigem.AVULSO && this.podeVincularChamadosAvulso(documento, user),
      checklistItens,
      podeAssinarInterno: await this.podeAssinarInterno(documento, user),
      podeDisponibilizarAssinatura:
        isAdministradorSistema(user) ||
        hasAnyPermission(user, ['documentos.disponibilizar_assinatura', 'documentos.administrar', 'usuarios.gerenciar']),
      podeVerAssinaturasAnteriores,
      assinaturasAnteriores: podeVerAssinaturasAnteriores
        ? anteriores.map((item) => this.mapAssinaturaApi(item, { fullPii: true }))
        : [],
      historico: historico.map((item) => ({
        id: item.id,
        statusAnterior: item.statusAnterior,
        statusNovo: item.statusNovo,
        motivo: item.motivo,
        metadata: item.metadata,
        createdAt: item.createdAt.toISOString(),
        alteradoPor: item.alteradoPor,
      })),
    };
  }

  async listByChamado(chamadoId: string, user: JwtPayload) {
    this.assertCanVisualizarRelacionado(user);
    return this.listRelated({ chamadoId, limit: '100' }, user);
  }

  async listByFiscalizacao(fiscalizacaoId: string, user: JwtPayload) {
    this.assertCanVisualizarRelacionado(user);
    return this.listRelated({ fiscalizacaoId, limit: '100' }, user);
  }

  async listChecklistsAvulso(user: JwtPayload) {
    this.assertCanVisualizar(user);
    const scope = resolveDirectSecretariaFilter(user);
    const secretariaIds =
      'secretariaId' in scope && scope.secretariaId
        ? typeof scope.secretariaId === 'string'
          ? [scope.secretariaId]
          : scope.secretariaId.in
        : null;

    const checklists = await this.prisma.checklist.findMany({
      where: {
        ativo: true,
        AND: [
          {
            OR: [
              { finalidade: ChecklistFinalidade.DOCUMENTO_AVULSO },
              { finalidades: { has: ChecklistFinalidade.DOCUMENTO_AVULSO } },
            ],
          },
          ...(secretariaIds
            ? [
                {
                  OR: [
                    { secretariaId: null },
                    { secretariaId: { in: secretariaIds } },
                  ],
                },
              ]
            : []),
        ],
      },
      orderBy: { nome: 'asc' },
      include: {
        versoes: {
          where: { status: ChecklistVersaoStatus.PUBLICADA },
          orderBy: { versao: 'desc' },
          take: 1,
          include: {
            itens: {
              where: { ativo: true },
              orderBy: { ordem: 'asc' },
              select: {
                id: true,
                codigo: true,
                secao: true,
                titulo: true,
                descricao: true,
                tipo: true,
                obrigatorio: true,
                exigeEvidencia: true,
                opcoes: true,
                ordem: true,
              },
            },
          },
        },
        secretaria: { select: { id: true, nome: true, sigla: true } },
      },
    });

    return checklists
      .filter((item) => item.versoes.length > 0)
      .map((item) => {
        const versao = item.versoes[0];
        return {
          id: item.id,
          nome: item.nome,
          descricao: item.descricao,
          finalidade: item.finalidade,
          finalidades: item.finalidades,
          secretaria: item.secretaria,
          versaoPublicada: {
            id: versao.id,
            versao: versao.versao,
            itens: versao.itens,
          },
        };
      });
  }

  async createAvulso(dto: CreateDocumentoAvulsoDto, user: JwtPayload) {
    this.assertPermission(user, ['documentos.criar_avulso', 'documentos.administrar']);
    const secretariaId = dto.secretariaId.trim();
    this.assertSecretariaNoEscopo(user, secretariaId);

    if (!dto.checklistVersaoId?.trim()) {
      throw new BadRequestException('Informe o checklist (checklistVersaoId) do documento avulso.');
    }

    const checklistVersao = await this.requireChecklistAvulsoVersao(dto.checklistVersaoId);
    const codigo = await this.nextCodigo();
    const codigoValidacao = this.nextCodigoValidacao();
    const codigoVerificador = generateCodigoVerificador(codigo, codigoValidacao);
    const titulo =
      dto.titulo?.trim() ||
      checklistVersao.checklist.nome ||
      TIPO_LABELS[dto.tipo] ||
      'Documento avulso';
    const chamadoIds = this.normalizarChamadoIds(dto.chamadoIds, dto.chamadoId);
    const chamadosVinculo = await this.assertChamadosVinculaveis(chamadoIds, user);

    const created = await this.prisma.documento.create({
      data: {
        codigo,
        codigoValidacao,
        tipo: dto.tipo,
        situacao: DocumentoSituacao.RASCUNHO,
        origem: DocumentoOrigem.AVULSO,
        titulo,
        descricao: dto.descricao?.trim() || null,
        secretariaId,
        unidadeId: dto.unidadeId || null,
        chamadoId: chamadosVinculo[0]?.id ?? null,
        fiscalizacaoId: dto.fiscalizacaoId || null,
        checklistVersaoId: checklistVersao.id,
        enderecoTexto: dto.enderecoTexto?.trim() || null,
        latitude: dto.latitude ?? null,
        longitude: dto.longitude ?? null,
        responsavelId: user.sub,
        criadoPorId: user.sub,
        metadata: {
          codigoVerificador,
        } as Prisma.InputJsonValue,
        ...(chamadosVinculo.length
          ? {
              chamadosVinculados: {
                create: chamadosVinculo.map((chamado) => ({
                  chamadoId: chamado.id,
                  createdById: user.sub,
                })),
              },
            }
          : {}),
      },
      include: DOCUMENTO_INCLUDE,
    });

    const contexto = await this.contextoAtuacao(user);
    const motivoCriacao = chamadosVinculo.length
      ? `Documento avulso criado e vinculado aos chamados: ${chamadosVinculo.map((item) => item.codigo).join(', ')}`
      : 'Documento avulso criado';
    await this.registrarHistorico(created.id, null, DocumentoSituacao.RASCUNHO, motivoCriacao, user.sub, {
      tipo: 'documento_vinculo',
      acao: 'criacao',
      chamadoIds: chamadosVinculo.map((item) => item.id),
      ...contexto,
    });
    for (const chamado of chamadosVinculo) {
      await this.registrarVinculoNaTimeline(chamado, created, user, 'vinculado', contexto);
    }
    await this.audit(user.sub, AuditAction.CREATE, created.id, null, {
      codigo: created.codigo,
      tipo: created.tipo,
      checklistVersaoId: checklistVersao.id,
    });

    if (dto.respostas?.length) {
      await this.saveRespostasInternal(created.id, dto.respostas, user, { skipLockCheck: false });
    }

    if (dto.concluir) {
      return this.concluirDocumento(created.id, user);
    }

    return this.serialize(await this.requireDocumentoFull(created.id, user));
  }

  async salvarRespostas(id: string, dto: SalvarDocumentoRespostasDto, user: JwtPayload) {
    this.assertPermission(user, [
      'documentos.criar_avulso',
      'documentos.gerar_pdf',
      'documentos.administrar',
    ]);
    await this.saveRespostasInternal(id, dto.respostas ?? [], user);

    if (dto.concluir) {
      return this.concluirDocumento(id, user);
    }

    return this.serialize(await this.requireDocumentoFull(id, user));
  }

  async concluirDocumento(id: string, user: JwtPayload) {
    this.assertPermission(user, [
      'documentos.criar_avulso',
      'documentos.gerar_pdf',
      'documentos.administrar',
    ]);
    const before = await this.requireDocumentoFull(id, user);
    this.assertConteudoEditavel(before);

    if (!before.checklistVersaoId) {
      throw new BadRequestException('Documento sem checklist vinculado não pode ser concluído.');
    }

    const itens = await this.prisma.checklistItem.findMany({
      where: { checklistVersaoId: before.checklistVersaoId, ativo: true },
      orderBy: { ordem: 'asc' },
    });
    const evidenciasPorItem = this.readEvidenciasPorItem(before.metadata);
    const validation = validateChecklistResponses(
      itens.map((item) => ({
        id: item.id,
        titulo: item.titulo,
        tipo: item.tipo,
        obrigatorio: item.obrigatorio,
        exigeEvidencia: item.exigeEvidencia,
        opcoes: item.opcoes,
      })),
      before.respostas.map((resposta) => ({
        itemId: resposta.itemId,
        conformidade: resposta.conformidade ?? ConformidadeStatus.CONFORME,
        valorTexto: this.respostaValorTexto(resposta),
        comentario: resposta.comentario,
        evidenciasCount: evidenciasPorItem[resposta.itemId]?.length ?? 0,
      })),
    );
    if (!validation.valid) {
      throw new BadRequestException(validation.reasons.join('; '));
    }

    const pdfBuffer = await this.buildDocumentoPdfBuffer(before, { incluirAssinaturas: false });
    const hash = sha256Buffer(pdfBuffer);
    const stored = await this.storageService.persistBuffer(pdfBuffer, 'application/pdf', 'documentos');

    const nextSituacao = DocumentoSituacao.SEM_ASSINATURA_EXTERNA;
    const updated = await this.prisma.documento.update({
      where: { id },
      data: {
        situacao: nextSituacao,
        pdfOriginalStorageKey: stored.storageKey,
        pdfOriginalUrl: stored.url,
        pdfOriginalSha256: hash,
      },
      include: DOCUMENTO_INCLUDE,
    });

    await this.registrarHistorico(
      id,
      before.situacao,
      nextSituacao,
      'Documento concluído e PDF original gerado',
      user.sub,
      { pdfOriginalSha256: hash },
    );
    await this.audit(
      user.sub,
      AuditAction.UPDATE,
      id,
      { situacao: before.situacao },
      { situacao: nextSituacao, pdfOriginalSha256: hash },
    );

    return this.serialize(updated);
  }

  async gerarPdfOriginal(id: string, user: JwtPayload) {
    this.assertPermission(user, ['documentos.gerar_pdf', 'documentos.administrar', 'documentos.visualizar']);
    const before = await this.requireDocumentoFull(id, user);

    if (
      before.conteudoTravadoEm ||
      before.situacao === DocumentoSituacao.ASSINADO_VIGENTE ||
      before.assinaturas.some((item) => !item.invalida)
    ) {
      throw new BadRequestException(
        'PDF original não pode ser regenerado após a primeira assinatura ou com conteúdo travado.',
      );
    }
    if (
      before.situacao === DocumentoSituacao.CANCELADO ||
      before.situacao === DocumentoSituacao.SUBSTITUIDO ||
      before.situacao === DocumentoSituacao.INVALIDO
    ) {
      throw new BadRequestException('Documento não permite geração de PDF nesta situação.');
    }
    if (before.situacao === DocumentoSituacao.RASCUNHO) {
      return this.concluirDocumento(id, user);
    }

    const meta = this.asRecord(before.metadata);
    const origemPdf = typeof meta.origemPdf === 'string' ? meta.origemPdf : null;
    const isAutoOrigem =
      before.origem === DocumentoOrigem.CHAMADO_EXECUCAO || before.origem === DocumentoOrigem.VISTORIA;
    const pdfCanonico =
      origemPdf === 'relatorio_execucao' || origemPdf === 'relatorio_vistoria';

    if (before.pdfOriginalStorageKey && (!isAutoOrigem || pdfCanonico)) {
      throw new BadRequestException(
        'PDF original já existe e não pode ser sobrescrito. Use cancelamento/retificação com auditoria se precisar de nova versão.',
      );
    }

    if (before.origem === DocumentoOrigem.VISTORIA) {
      throw new BadRequestException(
        before.pdfOriginalStorageKey
          ? 'PDF original de vistoria já existe e não pode ser sobrescrito.'
          : 'PDF original de vistoria ainda pendente. Ele é gerado automaticamente na conclusão da vistoria.',
      );
    }

    let pdfBuffer: Buffer;
    let origemPdfNext = origemPdf;
    if (before.origem === DocumentoOrigem.CHAMADO_EXECUCAO) {
      pdfBuffer = await this.buildRelatorioExecucaoFromDocumento(before);
      origemPdfNext = 'relatorio_execucao';
    } else {
      pdfBuffer = await this.buildDocumentoPdfBuffer(before, { incluirAssinaturas: false });
    }

    const hash = sha256Buffer(pdfBuffer);
    const stored = await this.storageService.persistBuffer(pdfBuffer, 'application/pdf', 'documentos');

    const nextSituacao =
      before.situacao === DocumentoSituacao.GERADO
        ? DocumentoSituacao.SEM_ASSINATURA_EXTERNA
        : before.situacao;

    const updated = await this.prisma.documento.update({
      where: { id },
      data: {
        situacao: nextSituacao,
        pdfOriginalStorageKey: stored.storageKey,
        pdfOriginalUrl: stored.url,
        pdfOriginalSha256: hash,
        metadata: {
          ...meta,
          origemPdf: origemPdfNext,
        } as Prisma.InputJsonValue,
      },
      include: DOCUMENTO_INCLUDE,
    });

    await this.registrarHistorico(
      id,
      before.situacao,
      nextSituacao,
      before.pdfOriginalStorageKey
        ? 'PDF original corrigido a partir da fonte da execução'
        : 'PDF original gerado',
      user.sub,
      { pdfOriginalSha256: hash, origemPdf: origemPdfNext },
    );
    await this.audit(
      user.sub,
      AuditAction.UPDATE,
      id,
      { situacao: before.situacao, pdfOriginalSha256: before.pdfOriginalSha256 },
      { situacao: nextSituacao, pdfOriginalSha256: hash, origemPdf: origemPdfNext },
    );

    return this.serialize(updated);
  }

  /**
   * Anexa PDF original somente se ainda não existir (imutável após criação).
   */
  async attachPdfOriginalIfAbsent(input: {
    documentoId: string;
    pdfBuffer: Buffer;
    userId?: string | null;
    motivo?: string;
    metadataExtra?: Record<string, unknown>;
  }) {
    const documento = await this.prisma.documento.findUnique({
      where: { id: input.documentoId },
      select: {
        id: true,
        situacao: true,
        pdfOriginalStorageKey: true,
        metadata: true,
        conteudoTravadoEm: true,
      },
    });
    if (!documento) throw new NotFoundException('Documento não encontrado.');
    if (documento.pdfOriginalStorageKey) {
      return this.serialize(await this.requireDocumentoFullById(documento.id));
    }
    if (documento.conteudoTravadoEm) {
      throw new BadRequestException('Conteúdo do documento está travado.');
    }

    const hash = sha256Buffer(input.pdfBuffer);
    const stored = await this.storageService.persistBuffer(input.pdfBuffer, 'application/pdf', 'documentos');
    const nextSituacao =
      documento.situacao === DocumentoSituacao.RASCUNHO || documento.situacao === DocumentoSituacao.GERADO
        ? DocumentoSituacao.SEM_ASSINATURA_EXTERNA
        : documento.situacao;

    const updated = await this.prisma.documento.update({
      where: { id: documento.id },
      data: {
        situacao: nextSituacao,
        pdfOriginalStorageKey: stored.storageKey,
        pdfOriginalUrl: stored.url,
        pdfOriginalSha256: hash,
        metadata: {
          ...this.asRecord(documento.metadata),
          ...(input.metadataExtra ?? {}),
        } as Prisma.InputJsonValue,
      },
      include: DOCUMENTO_INCLUDE,
    });

    await this.registrarHistorico(
      documento.id,
      documento.situacao,
      nextSituacao,
      input.motivo ?? 'PDF original anexado',
      input.userId ?? null,
      { pdfOriginalSha256: hash },
    );

    return this.serialize(updated);
  }

  async getPdfBuffer(id: string, variante: 'original' | 'assinado', user: JwtPayload) {
    const documento = await this.requireDocumentoVisivel(id, user);
    const key =
      variante === 'assinado' ? documento.pdfAssinadoStorageKey : documento.pdfOriginalStorageKey;
    if (!key) {
      throw new NotFoundException(
        variante === 'assinado' ? 'PDF assinado não disponível.' : 'PDF original não disponível.',
      );
    }
    const loaded = await this.storageService.readObjectBuffer(key, 'application/pdf');
    if (!loaded?.buffer.length) {
      throw new NotFoundException('Arquivo PDF não encontrado no armazenamento.');
    }
    return { buffer: loaded.buffer, codigo: documento.codigo, variante };
  }

  async updateVinculos(id: string, dto: UpdateDocumentoVinculosDto, user: JwtPayload) {
    const before = await this.requireDocumentoFull(id, user);
    const alteraChamadosAvulso =
      before.origem === DocumentoOrigem.AVULSO &&
      (dto.chamadoIds !== undefined || dto.chamadoId !== undefined);
    const somenteChamadosAvulso =
      alteraChamadosAvulso &&
      dto.unidadeId === undefined &&
      dto.fiscalizacaoId === undefined &&
      dto.enderecoTexto === undefined;
    if (somenteChamadosAvulso) {
      this.assertPodeVincularChamadosAvulso(before, user);
    } else {
      this.assertPermission(user, ['documentos.editar_vinculo', 'documentos.administrar']);
    }

    const previous = {
      unidadeId: before.unidadeId,
      chamadoId: before.chamadoId,
      chamadoIds: this.idsChamadosDoDocumento(before),
      fiscalizacaoId: before.fiscalizacaoId,
      enderecoTexto: before.enderecoTexto,
    };

    let chamadoIdsNovos = previous.chamadoIds;
    if (before.origem === DocumentoOrigem.AVULSO && (dto.chamadoIds !== undefined || dto.chamadoId !== undefined)) {
      chamadoIdsNovos = this.normalizarChamadoIds(
        dto.chamadoIds,
        dto.chamadoId === undefined ? undefined : dto.chamadoId,
      );
    } else if (before.origem !== DocumentoOrigem.AVULSO && dto.chamadoId !== undefined) {
      chamadoIdsNovos = dto.chamadoId ? [dto.chamadoId] : [];
    }
    const chamadosNovos = await this.assertChamadosVinculaveis(chamadoIdsNovos, user);
    const chamadoIdSincronizado =
      before.origem === DocumentoOrigem.AVULSO
        ? (chamadosNovos[0]?.id ?? null)
        : dto.chamadoId === undefined
          ? before.chamadoId
          : dto.chamadoId;

    const next = {
      unidadeId: dto.unidadeId === undefined ? before.unidadeId : dto.unidadeId,
      chamadoId: chamadoIdSincronizado,
      chamadoIds: chamadosNovos.map((item) => item.id),
      fiscalizacaoId: dto.fiscalizacaoId === undefined ? before.fiscalizacaoId : dto.fiscalizacaoId,
      enderecoTexto:
        dto.enderecoTexto === undefined ? before.enderecoTexto : dto.enderecoTexto?.trim() || null,
    };

    const chamadosMudaram = !mesmosIds(previous.chamadoIds, next.chamadoIds);
    if (chamadosMudaram && before.origem !== DocumentoOrigem.AVULSO && dto.chamadoIds !== undefined) {
      throw new BadRequestException(
        'O vínculo de origem de documentos de vistoria ou execução não é alterado por esta lista.',
      );
    }
    if (chamadosMudaram) {
      await this.substituirChamadosVinculados(id, chamadosNovos.map((item) => item.id), user.sub);
    }

    const updated = await this.prisma.documento.update({
      where: { id },
      data: {
        unidadeId: dto.unidadeId === undefined ? undefined : dto.unidadeId,
        chamadoId: chamadosMudaram || dto.chamadoId !== undefined ? chamadoIdSincronizado : undefined,
        fiscalizacaoId: dto.fiscalizacaoId === undefined ? undefined : dto.fiscalizacaoId,
        enderecoTexto: dto.enderecoTexto === undefined ? undefined : dto.enderecoTexto?.trim() || null,
        metadata: {
          ...this.asRecord(before.metadata),
          ultimoVinculo: {
            justificativa: dto.justificativa?.trim() || null,
            em: new Date().toISOString(),
            porId: user.sub,
            anterior: previous,
            novo: next,
          },
        } as Prisma.InputJsonValue,
      },
      include: DOCUMENTO_INCLUDE,
    });

    const contexto = await this.contextoAtuacao(user);
    const depoisConclusao = before.situacao !== DocumentoSituacao.RASCUNHO;
    await this.registrarHistorico(
      id,
      before.situacao,
      updated.situacao,
      dto.justificativa?.trim() ||
        (chamadosMudaram ? await this.motivoDiffChamados(before.codigo, previous.chamadoIds, chamadosNovos) : 'Vínculos do documento atualizados'),
      user.sub,
      {
        tipo: 'documento_vinculo',
        acao: chamadosMudaram ? 'atualizacao' : 'vinculos',
        anterior: previous,
        novo: next,
        depoisConclusao,
        ...contexto,
      },
    );
    if (chamadosMudaram) {
      await this.registrarDiffChamadosNaTimeline(before, updated, previous.chamadoIds, chamadosNovos, user, contexto);
    }
    await this.audit(
      user.sub,
      AuditAction.UPDATE,
      id,
      previous,
      {
        ...next,
        justificativa: dto.justificativa?.trim() || null,
      },
      depoisConclusao ? { ...contexto, descricao: 'Vínculo de chamados alterado após a conclusão do documento' } : undefined,
    );

    return this.serialize(updated, { usuarioId: user.sub });
  }

  async buscarChamadosParaVinculo(q: string | undefined, user: JwtPayload) {
    this.assertPodeBuscarChamados(user);
    const termo = q?.trim() ?? '';
    if (termo.length < 2) return { items: [] };
    const where: Prisma.ChamadoWhereInput = {
      AND: [
        this.whereChamadoVinculavel(user),
        {
          OR: [
            { codigo: { contains: termo, mode: 'insensitive' } },
            { titulo: { contains: termo, mode: 'insensitive' } },
            { descricao: { contains: termo, mode: 'insensitive' } },
            { enderecoTexto: { contains: termo, mode: 'insensitive' } },
            { tipoChamado: { nome: { contains: termo, mode: 'insensitive' } } },
            { unidade: { nome: { contains: termo, mode: 'insensitive' } } },
            { unidade: { codigoPatrimonial: { contains: termo, mode: 'insensitive' } } },
          ],
        },
      ],
    };
    const items = await this.prisma.chamado.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true,
        codigo: true,
        titulo: true,
        descricao: true,
        enderecoTexto: true,
        tipoChamado: { select: { nome: true } },
        unidade: { select: { nome: true, codigoPatrimonial: true } },
      },
    });
    return {
      items: items.map((item) => ({
        id: item.id,
        codigo: item.codigo,
        titulo: item.titulo,
        descricao: item.descricao,
        tipo: item.tipoChamado?.nome ?? null,
        endereco: item.enderecoTexto,
        unidade: item.unidade ? `${item.unidade.codigoPatrimonial} · ${item.unidade.nome}` : null,
      })),
    };
  }

  async coletarAssinatura(id: string, dto: ColetarAssinaturaDto, user: JwtPayload) {
    this.assertPermission(user, ['documentos.coletar_assinatura', 'documentos.administrar']);
    const before = await this.requireDocumentoFull(id, user);

    if (
      before.situacao === DocumentoSituacao.CANCELADO ||
      before.situacao === DocumentoSituacao.SUBSTITUIDO ||
      before.situacao === DocumentoSituacao.INVALIDO ||
      before.situacao === DocumentoSituacao.RASCUNHO
    ) {
      throw new BadRequestException('Documento não pode receber assinatura nesta situação.');
    }
    if (!before.pdfOriginalStorageKey || !before.pdfOriginalSha256) {
      throw new BadRequestException('Gere o PDF original antes de coletar assinatura.');
    }
    if (!dto.assinaturaDataUrl?.startsWith('data:')) {
      throw new BadRequestException('Informe a assinatura como data URL.');
    }

    const cpfInformado = Boolean(dto.assinanteDocumento?.replace(/\D/g, '').trim());
    const emailInformado = Boolean(dto.assinanteEmail?.trim());
    const cpfNaoInformado = Boolean(dto.cpfNaoInformado) || !cpfInformado;
    const emailNaoInformado = Boolean(dto.emailNaoInformado) || !emailInformado;

    if (!cpfInformado && !dto.cpfNaoInformado) {
      throw new BadRequestException('Informe o CPF ou marque que o assinante não informou CPF.');
    }
    if (!emailInformado && !dto.emailNaoInformado) {
      throw new BadRequestException('Informe o e-mail ou marque que o assinante não informou e-mail.');
    }
    if ((cpfNaoInformado || emailNaoInformado) && !(dto.justificativaIdentificacao?.trim().length)) {
      throw new BadRequestException(
        'Informe a justificativa da ausência de CPF e/ou e-mail.',
      );
    }
    if (cpfInformado && dto.assinanteDocumento!.replace(/\D/g, '').length < 11) {
      throw new BadRequestException('CPF inválido.');
    }
    if (emailInformado && !dto.assinanteEmail!.includes('@')) {
      throw new BadRequestException('E-mail inválido.');
    }

    const stored = await this.storageService.persistEvidenceUrl(dto.assinaturaDataUrl, dto.mimeType);
    const evidenciaSha256 = stored.checksum || sha256Buffer(
      Buffer.from(dto.assinaturaDataUrl.split(',')[1] ?? '', 'base64'),
    );

    const identificacaoMeta = {
      cpfNaoInformado: cpfNaoInformado && !cpfInformado,
      emailNaoInformado: emailNaoInformado && !emailInformado,
      justificativaIdentificacao: dto.justificativaIdentificacao?.trim() || null,
    };

    await this.prisma.documentoAssinatura.create({
      data: {
        documentoId: id,
        assinanteNome: dto.assinanteNome.trim(),
        assinanteDocumento: cpfInformado ? dto.assinanteDocumento!.trim() : null,
        assinanteEmail: emailInformado ? dto.assinanteEmail!.trim() : null,
        qualificacao: dto.qualificacao.trim(),
        qualificacaoOutro: dto.qualificacaoOutro?.trim() || null,
        canal: 'externa',
        evidenciaStorageKey: stored.storageKey,
        evidenciaUrl: stored.url,
        evidenciaSha256,
        coletadaPorId: user.sub,
        timezone: dto.timezone?.trim() || null,
        dispositivo: dto.dispositivo?.trim() || null,
        sessaoId: dto.sessaoId?.trim() || null,
        latitude: dto.latitude ?? null,
        longitude: dto.longitude ?? null,
        precisaoMetros: dto.precisaoMetros ?? null,
        localizacaoEm: dto.localizacaoEm ? new Date(dto.localizacaoEm) : null,
        pdfOriginalSha256: before.pdfOriginalSha256,
        metadata: identificacaoMeta as Prisma.InputJsonValue,
      },
    });

    const pendentesInternos = await this.contarPedidosPendentes(id);
    const manual = this.asRecord(before.metadata).assinaturaPendenteManual === true;
    const situacaoFinal =
      pendentesInternos > 0 || manual ? DocumentoSituacao.ASSINATURA_PENDENTE : DocumentoSituacao.ASSINADO_VIGENTE;
    const { updated, hashArquivoFinal } = await this.regenerarPdfAssinado(id, before.conteudoTravadoEm, situacaoFinal);
    if (before.situacao === DocumentoSituacao.ASSINATURA_PENDENTE && situacaoFinal !== DocumentoSituacao.ASSINATURA_PENDENTE) {
      await this.registrarHistorico(
        id,
        before.situacao,
        situacaoFinal,
        'Baixa automática da assinatura pendente.',
        user.sub,
        { acao: 'baixa_assinatura_pendente' },
      );
    }

    await this.registrarHistorico(
      id,
      before.situacao,
      situacaoFinal,
      `Assinatura coletada: ${dto.assinanteNome.trim()}${
        identificacaoMeta.cpfNaoInformado || identificacaoMeta.emailNaoInformado
          ? ' (identificação parcial)'
          : ''
      }`,
      user.sub,
      {
        acao: 'coletar_assinatura',
        pdfAssinadoSha256: hashArquivoFinal,
        assinanteNome: dto.assinanteNome.trim(),
        assinanteDocumento: cpfInformado
          ? dto.assinanteDocumento!.trim()
          : 'CPF não informado',
        assinanteEmail: emailInformado ? dto.assinanteEmail!.trim() : 'E-mail não informado',
        qualificacao: dto.qualificacaoOutro?.trim() || dto.qualificacao.trim(),
        coletadaPorId: user.sub,
        coletadaPorNome: user.nome,
        ...identificacaoMeta,
      },
    );
    await this.audit(
      user.sub,
      AuditAction.UPDATE,
      id,
      { situacao: before.situacao },
      {
        situacao: situacaoFinal,
        assinanteNome: dto.assinanteNome.trim(),
        pdfAssinadoSha256: hashArquivoFinal,
        ...identificacaoMeta,
      },
    );

    return this.serialize(updated);
  }

  async listMinhasPendenciasAssinatura(user: JwtPayload) {
    const where: Prisma.DocumentoWhereInput = {
      assinaturaPedidos: {
        some: { destinatarioId: user.sub, status: DocumentoAssinaturaPedidoStatus.PENDENTE },
      },
    };
    const [total, items] = await Promise.all([
      this.prisma.documento.count({ where }),
      this.prisma.documento.findMany({
        where,
        include: DOCUMENTO_INCLUDE,
        orderBy: { updatedAt: 'desc' },
        take: 50,
      }),
    ]);
    return {
      total,
      items: items.map((item) => this.serialize(item, { fullPii: true, usuarioId: user.sub })),
    };
  }

  async pendenciasResumo(user: JwtPayload) {
    const pedidos = await this.prisma.documentoAssinaturaPedido.findMany({
      where: { destinatarioId: user.sub, status: DocumentoAssinaturaPedidoStatus.PENDENTE },
      orderBy: { requestedAt: 'desc' },
      take: 40,
      include: {
        documento: {
          select: {
            id: true,
            codigo: true,
            titulo: true,
            situacao: true,
            secretaria: { select: { sigla: true, nome: true } },
          },
        },
      },
    });
    const total = await this.prisma.documentoAssinaturaPedido.count({
      where: { destinatarioId: user.sub, status: DocumentoAssinaturaPedidoStatus.PENDENTE },
    });
    const documentos = pedidos
      .map((pedido) => ({
        id: pedido.documento.id,
        codigo: pedido.documento.codigo,
        titulo: pedido.documento.titulo,
        prazo: null as string | null,
        status: pedido.documento.situacao,
        secretaria: pedido.documento.secretaria?.sigla ?? pedido.documento.secretaria?.nome ?? null,
        equipe: null as string | null,
        atrasado: false,
        href: `/documentos?id=${pedido.documento.id}&pendentes=1`,
        createdAt: pedido.requestedAt.toISOString(),
      }))
      .sort(ordenarPendencias);
    const tarefasBrutas = await this.prisma.chamadoTarefa.findMany({
      where: {
        responsavelId: user.sub,
        status: { in: [ChamadoTarefaStatus.NOVA, ChamadoTarefaStatus.VISUALIZADA, ChamadoTarefaStatus.EM_ANDAMENTO] },
        chamado: { excluidoEm: null },
      },
      take: 40,
      include: {
        secretaria: { select: { sigla: true, nome: true } },
        equipe: { select: { nome: true } },
        chamado: { select: { codigo: true } },
      },
    });
    const tarefas = tarefasBrutas
      .map((tarefa) => ({
        id: tarefa.id,
        codigo: tarefa.chamado.codigo,
        titulo: tarefa.titulo,
        prazo: tarefa.prazo?.toISOString() ?? null,
        status: tarefa.status,
        secretaria: tarefa.secretaria.sigla || tarefa.secretaria.nome,
        equipe: tarefa.equipe?.nome ?? null,
        atrasado: tarefaAtrasada(tarefa.status, tarefa.prazo),
        href: `/execucao?aba=tarefas&tarefa=${tarefa.id}`,
        createdAt: tarefa.createdAt.toISOString(),
      }))
      .sort(ordenarPendencias);
    const chamadosBrutos = await this.prisma.chamado.findMany({
      where: {
        responsavelId: user.sub,
        excluidoEm: null,
        status: { notIn: [ChamadoStatus.CONCLUIDO, ChamadoStatus.CANCELADO] },
      },
      take: 40,
      include: {
        secretaria: { select: { sigla: true, nome: true } },
        equipe: { select: { nome: true } },
      },
    });
    const chamados = chamadosBrutos
      .map((chamado) => ({
        id: chamado.id,
        codigo: chamado.codigo,
        titulo: chamado.titulo?.trim() || chamado.descricao.slice(0, 80),
        prazo: chamado.prazoEm?.toISOString() ?? null,
        status: chamado.status,
        secretaria: chamado.secretaria.sigla || chamado.secretaria.nome,
        equipe: chamado.equipe?.nome ?? null,
        atrasado: chamadoAtrasado(chamado.status, chamado.prazoEm),
        href: `/chamados?id=${chamado.id}`,
        createdAt: chamado.createdAt.toISOString(),
      }))
      .sort(ordenarPendencias);
    const grupos = [
      documentos.length
        ? { id: 'documentos', titulo: 'Documentos para assinatura', total, itens: documentos.slice(0, 8), verMaisHref: '/documentos?pendentes=1' }
        : null,
      tarefas.length
        ? { id: 'tarefas', titulo: 'Tarefas pendentes', total: tarefas.length, itens: tarefas.slice(0, 8), verMaisHref: '/execucao?aba=tarefas&atribuidaAMim=1' }
        : null,
      chamados.length
        ? { id: 'chamados', titulo: 'Chamados sob minha responsabilidade', total: chamados.length, itens: chamados.slice(0, 8), verMaisHref: '/chamados?atribuicao=MIM' }
        : null,
    ].filter((grupo): grupo is NonNullable<typeof grupo> => grupo != null);
    const totalGeral = grupos.reduce((sum, grupo) => sum + grupo.total, 0);
    return { total: totalGeral, grupos };
  }

  async listSignatariosInternos(search: string | undefined, user: JwtPayload) {
    this.assertPodeDisponibilizar(user);
    const term = search?.trim();
    const scope = resolveDirectSecretariaFilter(user);
    if ('id' in scope) return [];
    const secretariaFiltro =
      'secretariaId' in scope && scope.secretariaId
        ? {
            OR: [
              { secretariaId: typeof scope.secretariaId === 'string' ? scope.secretariaId : { in: scope.secretariaId.in } },
              { secretariaAtivaId: typeof scope.secretariaId === 'string' ? scope.secretariaId : { in: scope.secretariaId.in } },
            ],
          }
        : {};
    const usuarios = await this.prisma.usuario.findMany({
      where: {
        ativo: true,
        AND: [
          secretariaFiltro,
          ...(term
            ? [
                {
                  OR: [
                    { nome: { contains: term, mode: 'insensitive' as const } },
                    { email: { contains: term, mode: 'insensitive' as const } },
                    { cargo: { contains: term, mode: 'insensitive' as const } },
                    { cargoRef: { nome: { contains: term, mode: 'insensitive' as const } } },
                    { secretaria: { nome: { contains: term, mode: 'insensitive' as const } } },
                    { secretaria: { sigla: { contains: term, mode: 'insensitive' as const } } },
                    { perfilAtivo: { nome: { contains: term, mode: 'insensitive' as const } } },
                  ],
                },
              ]
            : []),
        ],
      },
      take: 30,
      orderBy: { nome: 'asc' },
      select: {
        id: true,
        nome: true,
        email: true,
        cargo: true,
        cargoRef: { select: { nome: true } },
        secretaria: { select: { id: true, nome: true, sigla: true } },
        perfilAtivo: { select: { id: true, nome: true } },
      },
    });
    return usuarios.map((item) => ({
      id: item.id,
      nome: item.nome,
      email: item.email,
      cargo: item.cargoRef?.nome || item.cargo,
      secretaria: item.secretaria,
      perfil: item.perfilAtivo?.nome ?? null,
    }));
  }

  async disponibilizarAssinaturaInterna(id: string, dto: DisponibilizarAssinaturaInternaDto, user: JwtPayload) {
    this.assertPodeDisponibilizar(user);
    const documento = await this.requireDocumentoFull(id, user);
    if (!documento.pdfOriginalStorageKey || documento.situacao === DocumentoSituacao.RASCUNHO) {
      throw new BadRequestException('Disponibilize apenas documentos concluídos, com PDF original.');
    }
    if (
      documento.situacao === DocumentoSituacao.CANCELADO ||
      documento.situacao === DocumentoSituacao.SUBSTITUIDO ||
      documento.situacao === DocumentoSituacao.INVALIDO
    ) {
      throw new BadRequestException('Documento não pode ser encaminhado para assinatura nesta situação.');
    }
    const ids = [...new Set(dto.destinatarioIds)];
    if (!ids.length) throw new BadRequestException('Selecione ao menos um usuário.');
    const ativos = await this.prisma.usuario.findMany({
      where: { id: { in: ids }, ativo: true },
      select: { id: true, nome: true },
    });
    if (ativos.length !== ids.length) {
      throw new BadRequestException('Há destinatário inativo ou inexistente.');
    }
    const now = new Date();
    for (const destinatarioId of ids) {
      const aberto = await this.prisma.documentoAssinaturaPedido.findFirst({
        where: { documentoId: id, destinatarioId, status: DocumentoAssinaturaPedidoStatus.PENDENTE },
        select: { id: true },
      });
      if (aberto) continue;
      await this.prisma.documentoAssinaturaPedido.create({
        data: {
          documentoId: id,
          destinatarioId,
          solicitanteId: user.sub,
          status: DocumentoAssinaturaPedidoStatus.PENDENTE,
          requestedAt: now,
        },
      });
    }
    const nomes = ativos.map((item) => item.nome).join(', ');
    const contexto = await this.contextoAtuacaoDocumento(user);
    await this.registrarHistorico(
      id,
      documento.situacao,
      documento.situacao,
      `Documento disponibilizado para assinatura interna: ${nomes}`,
      user.sub,
      { acao: 'disponibilizar_assinatura', destinatarioIds: ids, ...contexto },
    );
    await this.sincronizarSituacaoAssinatura(id, user.sub, 'Assinatura pendente criada pelo encaminhamento interno.');
    await this.audit(user.sub, AuditAction.UPDATE, id, null, {
      acao: 'disponibilizar_assinatura',
      destinatarioIds: ids,
    });
    return this.getById(id, user);
  }

  async retirarAssinaturaInterna(pedidoId: string, user: JwtPayload, motivo?: string) {
    this.assertPodeDisponibilizar(user);
    const pedido = await this.prisma.documentoAssinaturaPedido.findUnique({
      where: { id: pedidoId },
      include: { destinatario: { select: { nome: true } } },
    });
    if (!pedido || pedido.status !== DocumentoAssinaturaPedidoStatus.PENDENTE) {
      throw new NotFoundException('Pedido de assinatura não encontrado.');
    }
    const documento = await this.requireDocumentoFull(pedido.documentoId, user);
    const justificativa = motivo?.trim() || '';
    const updated = await this.prisma.documentoAssinaturaPedido.update({
      where: { id: pedidoId },
      data: {
        status: DocumentoAssinaturaPedidoStatus.RETIRADO,
        retiradoEm: new Date(),
        canceladoMotivo: justificativa || null,
      },
    });
    const contexto = await this.contextoAtuacaoDocumento(user);
    await this.registrarHistorico(
      pedido.documentoId,
      documento.situacao,
      documento.situacao,
      `Disponibilização cancelada para ${pedido.destinatario.nome}${justificativa ? `: ${justificativa}` : '.'}`,
      user.sub,
      { acao: 'retirar_assinatura', pedidoId, destinatarioId: pedido.destinatarioId, justificativa: justificativa || null, ...contexto },
    );
    await this.sincronizarSituacaoAssinatura(
      pedido.documentoId,
      user.sub,
      'Baixa automática da assinatura pendente: não há signatário interno pendente.',
    );
    await this.audit(user.sub, AuditAction.UPDATE, pedido.documentoId, { status: pedido.status }, {
      acao: 'retirar_assinatura',
      pedidoId,
      status: updated.status,
    });
    return this.getById(pedido.documentoId, user);
  }

  async recusarAssinaturaInterna(pedidoId: string, dto: RecusarAssinaturaInternaDto, user: JwtPayload) {
    const pedido = await this.prisma.documentoAssinaturaPedido.findFirst({
      where: { id: pedidoId, destinatarioId: user.sub, status: DocumentoAssinaturaPedidoStatus.PENDENTE },
    });
    if (!pedido) throw new NotFoundException('Pedido de assinatura não encontrado.');
    await this.prisma.documentoAssinaturaPedido.update({
      where: { id: pedidoId },
      data: {
        status: DocumentoAssinaturaPedidoStatus.CANCELADO,
        canceladoEm: new Date(),
        canceladoMotivo: dto.motivo?.trim() || 'Recusa do destinatário',
      },
    });
    await this.registrarHistorico(
      pedido.documentoId,
      DocumentoAssinaturaPedidoStatus.PENDENTE,
      DocumentoAssinaturaPedidoStatus.CANCELADO,
      `Assinatura interna recusada${dto.motivo?.trim() ? `: ${dto.motivo.trim()}` : '.'}`,
      user.sub,
      { acao: 'recusar_assinatura', pedidoId },
    );
    await this.audit(user.sub, AuditAction.UPDATE, pedido.documentoId, null, {
      acao: 'recusar_assinatura',
      pedidoId,
    });
    await this.sincronizarSituacaoAssinatura(
      pedido.documentoId,
      user.sub,
      'Baixa automática da assinatura pendente: não há signatário interno pendente.',
    );
    return { ok: true };
  }

  async assinarInterno(
    id: string,
    dto: AssinarDocumentoInternoDto,
    user: JwtPayload,
    meta: { ip?: string | null; userAgent?: string | null },
  ) {
    if (!dto.confirmacao) {
      throw new BadRequestException('Confirme a assinatura deste documento.');
    }
    const documento = await this.prisma.documento.findFirst({
      where: { id },
      include: DOCUMENTO_INCLUDE,
    });
    if (!documento) throw new NotFoundException('Documento não encontrado.');
    const permitido = await this.podeAssinarInterno(documento, user);
    if (!permitido) {
      throw new BadRequestException(
        'Somente o elaborador, um destinatário da solicitação ou um administrador pode assinar este documento.',
      );
    }
    if (
      documento.situacao === DocumentoSituacao.CANCELADO ||
      documento.situacao === DocumentoSituacao.SUBSTITUIDO ||
      documento.situacao === DocumentoSituacao.INVALIDO ||
      documento.situacao === DocumentoSituacao.RASCUNHO ||
      !documento.pdfOriginalStorageKey
    ) {
      throw new BadRequestException('Documento não pode receber assinatura interna nesta situação.');
    }

    const usuario = await this.prisma.usuario.findUnique({
      where: { id: user.sub },
      select: {
        id: true,
        nome: true,
        email: true,
        cpf: true,
        senhaHash: true,
        cargo: true,
        cargoId: true,
        cargoRef: { select: { nome: true } },
      },
    });
    if (!usuario || !verifyPassword(dto.senha, usuario.senhaHash)) {
      throw new BadRequestException('Senha inválida.');
    }

    const cargo = usuario.cargoRef?.nome || usuario.cargo || null;
    await this.prisma.documentoAssinatura.create({
      data: {
        documentoId: id,
        assinanteNome: usuario.nome,
        assinanteDocumento: usuario.cpf,
        assinanteEmail: usuario.email,
        qualificacao: cargo,
        assinanteUsuarioId: usuario.id,
        canal: 'interna',
        coletadaPorId: user.sub,
        ip: meta.ip ?? null,
        userAgent: meta.userAgent ?? null,
        pdfOriginalSha256: documento.pdfOriginalSha256,
        metadata: {
          tipo: 'interna',
          metodo: 'usuario_senha',
          usuarioId: usuario.id,
          cargo,
          cargoId: usuario.cargoId,
          confirmacao: true,
        } as Prisma.InputJsonValue,
      },
    });

    await this.prisma.documentoAssinaturaPedido.updateMany({
      where: {
        documentoId: id,
        destinatarioId: user.sub,
        status: DocumentoAssinaturaPedidoStatus.PENDENTE,
      },
      data: { status: DocumentoAssinaturaPedidoStatus.ASSINADO, signedAt: new Date() },
    });

    const pendentesRestantes = await this.contarPedidosPendentes(id);
    const manual = this.asRecord(documento.metadata).assinaturaPendenteManual === true;
    const situacaoFinal =
      pendentesRestantes > 0 || manual ? DocumentoSituacao.ASSINATURA_PENDENTE : DocumentoSituacao.ASSINADO_VIGENTE;
    const { hashArquivoFinal } = await this.regenerarPdfAssinado(id, documento.conteudoTravadoEm, situacaoFinal);
    if (documento.situacao === DocumentoSituacao.ASSINATURA_PENDENTE && situacaoFinal !== DocumentoSituacao.ASSINATURA_PENDENTE) {
      await this.registrarHistorico(
        id,
        documento.situacao,
        situacaoFinal,
        'Baixa automática da assinatura pendente.',
        user.sub,
        { acao: 'baixa_assinatura_pendente', ...(await this.contextoAtuacaoDocumento(user)) },
      );
    }
    await this.registrarHistorico(
      id,
      documento.situacao,
      situacaoFinal,
      `Documento assinado eletronicamente por ${usuario.nome}`,
      user.sub,
      {
        acao: 'assinar_interno',
        metodo: 'usuario_senha',
        pdfAssinadoSha256: hashArquivoFinal,
        assinanteUsuarioId: usuario.id,
        assinanteNome: usuario.nome,
        assinanteEmail: usuario.email,
        cargo,
      },
    );
    await this.audit(user.sub, AuditAction.UPDATE, id, { situacao: documento.situacao }, {
      acao: 'assinar_interno',
      situacao: situacaoFinal,
      pdfAssinadoSha256: hashArquivoFinal,
      assinanteUsuarioId: usuario.id,
    });
    return this.getById(id, user);
  }

  private async regenerarPdfAssinado(
    id: string,
    conteudoTravadoEm: Date | null,
    situacao: DocumentoSituacao = DocumentoSituacao.ASSINADO_VIGENTE,
  ) {
    const withAssinaturas = await this.requireDocumentoFullById(id);
    const basePdf = await this.resolvePdfBaseParaAssinatura(withAssinaturas);
    const assinaturasValidas = withAssinaturas.assinaturas.filter((item) => !item.invalida);
    const assinaturasPdf = [];
    for (const assinatura of assinaturasValidas) {
      let imageBuffer: Buffer | null = null;
      if (assinatura.canal !== 'interna' && assinatura.evidenciaStorageKey) {
        const loaded = await this.storageService.readObjectBuffer(assinatura.evidenciaStorageKey, 'image/png');
        imageBuffer = loaded?.buffer
          ? (await shrinkImageForPdf(loaded.buffer, loaded.mimeType || 'image/jpeg')).buffer
          : null;
      }
      const meta = this.asRecord(assinatura.metadata);
      assinaturasPdf.push({
        canal: assinatura.canal,
        assinanteNome: assinatura.assinanteNome,
        assinanteDocumento:
          assinatura.canal === 'interna'
            ? null
            : displayAssinanteCpf({
                cpf: assinatura.assinanteDocumento,
                cpfNaoInformado: Boolean(meta.cpfNaoInformado),
              }),
        assinanteEmail:
          assinatura.canal === 'interna'
            ? assinatura.assinanteEmail
            : displayAssinanteEmail({
                email: assinatura.assinanteEmail,
                emailNaoInformado: Boolean(meta.emailNaoInformado),
              }),
        qualificacao: assinatura.qualificacaoOutro?.trim() || assinatura.qualificacao,
        coletadaEm: assinatura.coletadaEm.toISOString(),
        imageBuffer,
      });
    }

    const codigoVerificador = generateCodigoVerificador(withAssinaturas.codigo, withAssinaturas.codigoValidacao);
    const validationUrl = buildPublicValidationUrl(withAssinaturas.codigoValidacao, codigoVerificador);
    const { pdfBuffer, hashArquivoFinal } = await appendAssinaturasAoPdfOriginal(basePdf, assinaturasPdf, {
      codigo: withAssinaturas.codigo,
      codigoValidacao: withAssinaturas.codigoValidacao,
      codigoVerificador,
      situacaoLabel: SITUACAO_LABELS[DocumentoSituacao.ASSINADO_VIGENTE],
      geradoEm: new Date().toLocaleString('pt-BR'),
      validationUrl,
    });
    const storedPdf = await this.storageService.persistBuffer(pdfBuffer, 'application/pdf', 'documentos');
    const updated = await this.prisma.documento.update({
      where: { id },
      data: {
        situacao,
        conteudoTravadoEm: conteudoTravadoEm ?? new Date(),
        pdfAssinadoStorageKey: storedPdf.storageKey,
        pdfAssinadoUrl: storedPdf.url,
        pdfAssinadoSha256: hashArquivoFinal,
      },
      include: DOCUMENTO_INCLUDE,
    });
    await this.prisma.documentoAssinatura.updateMany({
      where: { documentoId: id, invalida: false },
      data: { pdfAssinadoSha256: hashArquivoFinal },
    });
    return { updated, hashArquivoFinal };
  }

  private assertPodeDisponibilizar(user: JwtPayload) {
    if (isAdministradorSistema(user)) return;
    if (
      !hasAnyPermission(user, [
        'documentos.disponibilizar_assinatura',
        'documentos.administrar',
        'usuarios.gerenciar',
      ])
    ) {
      throw new ForbiddenException('Sem permissão para disponibilizar assinatura interna.');
    }
  }

  private async podeAssinarInterno(
    documento: { id: string; criadoPorId: string | null; responsavelId: string | null },
    user: JwtPayload,
  ) {
    if (isAdministradorSistema(user) || hasAnyPermission(user, ['documentos.administrar', 'usuarios.gerenciar'])) {
      return true;
    }
    const pedido = await this.prisma.documentoAssinaturaPedido.findFirst({
      where: {
        documentoId: documento.id,
        destinatarioId: user.sub,
        status: DocumentoAssinaturaPedidoStatus.PENDENTE,
      },
      select: { id: true },
    });
    if (pedido) return true;
    const elaborador = documento.criadoPorId === user.sub || documento.responsavelId === user.sub;
    return elaborador && hasAnyPermission(user, ['documentos.assinar_interno']);
  }

  /**
   * Base do PDF para assinatura: conteúdo sem selo antigo de autenticidade do original
   * (evita “Sem assinatura externa” residual no PDF assinado).
   */
  private async resolvePdfBaseParaAssinatura(documento: DocumentoLoaded) {
    const usaBuilderDocumento =
      documento.origem === DocumentoOrigem.AVULSO ||
      documento.origem === DocumentoOrigem.SISTEMA ||
      documento.tipo === DocumentoTipo.DOCUMENTO_AVULSO;

    if (usaBuilderDocumento) {
      return this.buildDocumentoPdfBuffer(documento, {
        incluirAssinaturas: false,
        incluirBlocoAutenticidade: false,
      });
    }

    if (!documento.pdfOriginalStorageKey) {
      throw new BadRequestException('PDF original indisponível para assinatura.');
    }
    const originalLoaded = await this.storageService.readObjectBuffer(
      documento.pdfOriginalStorageKey,
      'application/pdf',
    );
    if (!originalLoaded?.buffer.length) {
      throw new NotFoundException('PDF original não encontrado no armazenamento.');
    }
    return originalLoaded.buffer;
  }

  async cancelarAssinado(id: string, dto: CancelarDocumentoDto, user: JwtPayload) {
    this.assertPermission(user, ['documentos.cancelar_assinado', 'documentos.administrar']);
    const before = await this.requireDocumentoFull(id, user);
    if (!before.pdfAssinadoStorageKey) {
      throw new BadRequestException('Não há PDF assinado vigente para cancelar.');
    }
    if (
      before.situacao !== DocumentoSituacao.ASSINADO_VIGENTE &&
      before.situacao !== DocumentoSituacao.ASSINATURA_PENDENTE
    ) {
      throw new BadRequestException(
        'Somente documentos assinados ou com assinatura pendente podem ter o PDF assinado cancelado.',
      );
    }

    const motivo = dto.motivo.trim();
    const now = new Date();
    const assinaturasValidas = before.assinaturas.filter((item) => !item.invalida);

    for (const assinatura of assinaturasValidas) {
      const meta = this.asRecord(assinatura.metadata);
      await this.prisma.documentoAssinatura.update({
        where: { id: assinatura.id },
        data: {
          invalida: true,
          invalidadaEm: now,
          invalidadaMotivo: motivo,
          metadata: {
            ...meta,
            invalidadaPorId: user.sub,
            invalidadaPorNome: user.nome,
            invalidadaPorEmail: user.email,
            pdfAssinadoSha256Cancelado: before.pdfAssinadoSha256,
          } as Prisma.InputJsonValue,
        },
      });
    }

    const nextSituacao = DocumentoSituacao.SEM_ASSINATURA_EXTERNA;
    const assinaturasInvalidasSnapshot = assinaturasValidas.map((item) =>
      this.snapshotAssinaturaHistorico(item),
    );
    const updated = await this.prisma.documento.update({
      where: { id },
      data: {
        situacao: nextSituacao,
        pdfAssinadoStorageKey: null,
        pdfAssinadoUrl: null,
        pdfAssinadoSha256: null,
        metadata: {
          ...this.asRecord(before.metadata),
          cancelamentoAssinado: {
            motivo,
            em: now.toISOString(),
            porId: user.sub,
            porNome: user.nome,
            assinaturasInvalidas: assinaturasInvalidasSnapshot,
          },
        } as Prisma.InputJsonValue,
      },
      include: DOCUMENTO_INCLUDE,
    });

    await this.registrarHistorico(
      id,
      before.situacao,
      nextSituacao,
      `PDF assinado vigente cancelado: ${motivo}`,
      user.sub,
      {
        acao: 'cancelar_pdf_assinado',
        assinaturasInvalidas: assinaturasInvalidasSnapshot,
        canceladoPorId: user.sub,
        canceladoPorNome: user.nome,
        canceladoEm: now.toISOString(),
        pdfAssinadoSha256Cancelado: before.pdfAssinadoSha256,
      },
    );
    await this.audit(
      user.sub,
      AuditAction.UPDATE,
      id,
      { situacao: before.situacao, pdfAssinadoSha256: before.pdfAssinadoSha256 },
      {
        situacao: nextSituacao,
        motivo,
        assinaturasInvalidasCount: assinaturasValidas.length,
      },
    );

    return this.serialize(updated);
  }

  private async contarPedidosPendentes(documentoId: string) {
    return this.prisma.documentoAssinaturaPedido.count({
      where: { documentoId, status: DocumentoAssinaturaPedidoStatus.PENDENTE },
    });
  }

  /** Mantém Assinatura pendente enquanto houver pedido interno ou marcação manual. */
  private async sincronizarSituacaoAssinatura(id: string, userId: string, motivoQuandoMuda: string) {
    const documento = await this.requireDocumentoFullById(id);
    if (
      documento.situacao === DocumentoSituacao.CANCELADO ||
      documento.situacao === DocumentoSituacao.SUBSTITUIDO ||
      documento.situacao === DocumentoSituacao.INVALIDO ||
      documento.situacao === DocumentoSituacao.RASCUNHO
    ) {
      return documento.situacao;
    }
    const pendentes = await this.contarPedidosPendentes(id);
    const manual = this.asRecord(documento.metadata).assinaturaPendenteManual === true;
    const desejada =
      pendentes > 0 || manual
        ? DocumentoSituacao.ASSINATURA_PENDENTE
        : documento.pdfAssinadoStorageKey
          ? DocumentoSituacao.ASSINADO_VIGENTE
          : documento.situacao === DocumentoSituacao.ASSINATURA_PENDENTE
            ? DocumentoSituacao.SEM_ASSINATURA_EXTERNA
            : documento.situacao;
    if (desejada === documento.situacao) return documento.situacao;
    await this.prisma.documento.update({ where: { id }, data: { situacao: desejada } });
    await this.registrarHistorico(id, documento.situacao, desejada, motivoQuandoMuda, userId, {
      acao: desejada === DocumentoSituacao.ASSINATURA_PENDENTE ? 'assinatura_pendente_automatica' : 'baixa_assinatura_pendente',
      pedidosPendentes: pendentes,
      manual,
    });
    return desejada;
  }

  private async contextoAtuacaoDocumento(user: JwtPayload) {
    const [perfil, secretaria] = await Promise.all([
      user.perfilAtivoId
        ? this.prisma.perfil.findUnique({ where: { id: user.perfilAtivoId }, select: { nome: true } })
        : Promise.resolve(null),
      user.secretariaId
        ? this.prisma.secretaria.findUnique({ where: { id: user.secretariaId }, select: { sigla: true, nome: true } })
        : Promise.resolve(null),
    ]);
    return {
      perfilAtivo: perfil?.nome ?? user.perfis?.[0] ?? null,
      secretariaAtiva: secretaria ? `${secretaria.sigla} — ${secretaria.nome}` : null,
    };
  }

  /**
   * Alterna marcação operacional de assinatura pendente (não invalida assinaturas nem PDF).
   */
  async toggleAssinaturaPendente(id: string, user: JwtPayload) {
    this.assertPermission(user, ['documentos.coletar_assinatura', 'documentos.administrar']);
    const before = await this.requireDocumentoFull(id, user);
    if (!before.pdfOriginalStorageKey) {
      throw new BadRequestException('Gere o PDF original antes de alterar a pendência de assinatura.');
    }
    if (
      before.situacao === DocumentoSituacao.CANCELADO ||
      before.situacao === DocumentoSituacao.SUBSTITUIDO ||
      before.situacao === DocumentoSituacao.INVALIDO ||
      before.situacao === DocumentoSituacao.RASCUNHO
    ) {
      throw new BadRequestException('Documento não permite alterar pendência de assinatura nesta situação.');
    }

    const temAssinaturaVigente =
      Boolean(before.pdfAssinadoStorageKey) &&
      before.assinaturas.some((item) => !item.invalida);

    let nextSituacao: DocumentoSituacao;
    let motivo: string;

    const meta = this.asRecord(before.metadata);
    const pendentesInternos = await this.contarPedidosPendentes(id);
    if (before.situacao === DocumentoSituacao.ASSINATURA_PENDENTE) {
      if (pendentesInternos > 0) {
        throw new BadRequestException(
          'Não é possível desmarcar enquanto houver signatário interno pendente. Cancele a disponibilização.',
        );
      }
      nextSituacao = temAssinaturaVigente
        ? DocumentoSituacao.ASSINADO_VIGENTE
        : DocumentoSituacao.SEM_ASSINATURA_EXTERNA;
      motivo = 'Pendência de assinatura removida';
      meta.assinaturaPendenteManual = false;
    } else {
      nextSituacao = DocumentoSituacao.ASSINATURA_PENDENTE;
      motivo = 'Assinatura marcada como pendente';
      meta.assinaturaPendenteManual = true;
    }

    const updated = await this.prisma.documento.update({
      where: { id },
      data: { situacao: nextSituacao, metadata: meta as Prisma.InputJsonValue },
      include: DOCUMENTO_INCLUDE,
    });

    await this.registrarHistorico(id, before.situacao, nextSituacao, motivo, user.sub, {
      acao: 'toggle_assinatura_pendente',
    });
    await this.audit(
      user.sub,
      AuditAction.UPDATE,
      id,
      { situacao: before.situacao },
      { situacao: nextSituacao, motivo },
    );

    return this.serialize(updated);
  }

  /** @deprecated use toggleAssinaturaPendente */
  async marcarAssinaturaPendente(id: string, user: JwtPayload) {
    return this.toggleAssinaturaPendente(id, user);
  }

  /**
   * Cria ou atualiza documento a partir de vistoria concluída.
   * Aceita PDF já gerado para evitar dependência circular de módulos.
   */
  async upsertFromFiscalizacao(input: {
    fiscalizacaoId: string;
    secretariaId: string;
    unidadeId: string;
    checklistVersaoId?: string | null;
    responsavelId?: string | null;
    criadoPorId?: string | null;
    titulo: string;
    descricao?: string | null;
    pdfBuffer?: Buffer | null;
  }) {
    const existing = await this.prisma.documento.findFirst({
      where: {
        fiscalizacaoId: input.fiscalizacaoId,
        tipo: DocumentoTipo.RELATORIO_VISTORIA,
        situacao: {
          notIn: [
            DocumentoSituacao.CANCELADO,
            DocumentoSituacao.SUBSTITUIDO,
            DocumentoSituacao.INVALIDO,
          ],
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    let stored: { storageKey: string; url: string; sha256?: string } | null = null;
    if (input.pdfBuffer?.length) {
      try {
        const persisted = await this.storageService.persistBuffer(
          input.pdfBuffer,
          'application/pdf',
          'documentos',
        );
        stored = {
          storageKey: persisted.storageKey,
          url: persisted.url,
          sha256: sha256Buffer(input.pdfBuffer),
        };
      } catch (error) {
        this.logger.warn(
          `Falha ao persistir PDF da vistoria ${input.fiscalizacaoId}: ${error instanceof Error ? error.message : 'erro'}`,
        );
      }
    }

    if (existing) {
      if (existing.conteudoTravadoEm || existing.situacao === DocumentoSituacao.ASSINADO_VIGENTE) {
        return this.serialize(await this.requireDocumentoFullById(existing.id));
      }
      const canAttachPdf = Boolean(stored) && !existing.pdfOriginalStorageKey;
      const existingMeta = this.asRecord(existing.metadata);
      const updated = await this.prisma.documento.update({
        where: { id: existing.id },
        data: {
          titulo: input.titulo,
          descricao: input.descricao ?? existing.descricao,
          checklistVersaoId: input.checklistVersaoId ?? existing.checklistVersaoId,
          responsavelId: input.responsavelId ?? existing.responsavelId,
          metadata: {
            ...existingMeta,
            ...(canAttachPdf || existing.pdfOriginalStorageKey
              ? { origemPdf: existingMeta.origemPdf ?? 'relatorio_vistoria' }
              : {}),
          } as Prisma.InputJsonValue,
          ...(canAttachPdf
            ? {
                pdfOriginalStorageKey: stored!.storageKey,
                pdfOriginalUrl: stored!.url,
                pdfOriginalSha256: stored!.sha256,
                situacao:
                  existing.situacao === DocumentoSituacao.RASCUNHO ||
                  existing.situacao === DocumentoSituacao.GERADO
                    ? DocumentoSituacao.SEM_ASSINATURA_EXTERNA
                    : existing.situacao,
              }
            : {}),
        },
        include: DOCUMENTO_INCLUDE,
      });
      return this.serialize(updated);
    }

    const codigo = await this.nextCodigo();
    const codigoValidacao = this.nextCodigoValidacao();
    const codigoVerificador = generateCodigoVerificador(codigo, codigoValidacao);
    const created = await this.prisma.documento.create({
      data: {
        codigo,
        codigoValidacao,
        tipo: DocumentoTipo.RELATORIO_VISTORIA,
        situacao: stored ? DocumentoSituacao.SEM_ASSINATURA_EXTERNA : DocumentoSituacao.GERADO,
        origem: DocumentoOrigem.VISTORIA,
        titulo: input.titulo,
        descricao: input.descricao ?? null,
        secretariaId: input.secretariaId,
        unidadeId: input.unidadeId,
        fiscalizacaoId: input.fiscalizacaoId,
        checklistVersaoId: input.checklistVersaoId ?? null,
        responsavelId: input.responsavelId ?? null,
        criadoPorId: input.criadoPorId ?? null,
        pdfOriginalStorageKey: stored?.storageKey ?? null,
        pdfOriginalUrl: stored?.url ?? null,
        pdfOriginalSha256: stored?.sha256 ?? null,
        metadata: {
          codigoVerificador,
          ...(stored ? { origemPdf: 'relatorio_vistoria' } : {}),
        } as Prisma.InputJsonValue,
      },
      include: DOCUMENTO_INCLUDE,
    });

    await this.registrarHistorico(
      created.id,
      null,
      created.situacao,
      'Documento gerado a partir de vistoria concluída',
      input.criadoPorId ?? null,
    );

    return this.serialize(created);
  }

  /**
   * Cria ou atualiza documento a partir de execução de chamado.
   */
  async upsertFromChamadoExecucao(input: {
    chamadoId: string;
    secretariaId: string;
    unidadeId?: string | null;
    enderecoTexto?: string | null;
    checklistVersaoId?: string | null;
    responsavelId?: string | null;
    criadoPorId?: string | null;
    titulo: string;
    descricao?: string | null;
    pdfBuffer?: Buffer | null;
    metadata?: Record<string, unknown> | null;
  }) {
    const existing = await this.prisma.documento.findFirst({
      where: {
        chamadoId: input.chamadoId,
        tipo: DocumentoTipo.RELATORIO_EXECUCAO,
        situacao: {
          notIn: [
            DocumentoSituacao.CANCELADO,
            DocumentoSituacao.SUBSTITUIDO,
            DocumentoSituacao.INVALIDO,
          ],
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    let stored: { storageKey: string; url: string; sha256?: string } | null = null;
    if (input.pdfBuffer?.length) {
      try {
        const persisted = await this.storageService.persistBuffer(
          input.pdfBuffer,
          'application/pdf',
          'documentos',
        );
        stored = {
          storageKey: persisted.storageKey,
          url: persisted.url,
          sha256: sha256Buffer(input.pdfBuffer),
        };
      } catch (error) {
        this.logger.warn(
          `Falha ao persistir PDF da execução ${input.chamadoId}: ${error instanceof Error ? error.message : 'erro'}`,
        );
      }
    }

    if (existing) {
      if (existing.conteudoTravadoEm || existing.situacao === DocumentoSituacao.ASSINADO_VIGENTE) {
        return this.serialize(await this.requireDocumentoFullById(existing.id));
      }
      const canAttachPdf = Boolean(stored) && !existing.pdfOriginalStorageKey;
      const mergedMeta = {
        ...this.asRecord(existing.metadata),
        ...(input.metadata ?? {}),
        ...(canAttachPdf || existing.pdfOriginalStorageKey
          ? { origemPdf: this.asRecord(existing.metadata).origemPdf ?? 'relatorio_execucao' }
          : {}),
      };
      const updated = await this.prisma.documento.update({
        where: { id: existing.id },
        data: {
          titulo: input.titulo,
          descricao: input.descricao ?? existing.descricao,
          unidadeId: input.unidadeId ?? existing.unidadeId,
          enderecoTexto: input.enderecoTexto ?? existing.enderecoTexto,
          checklistVersaoId: input.checklistVersaoId ?? existing.checklistVersaoId,
          responsavelId: input.responsavelId ?? existing.responsavelId,
          metadata: mergedMeta as Prisma.InputJsonValue,
          ...(canAttachPdf
            ? {
                pdfOriginalStorageKey: stored!.storageKey,
                pdfOriginalUrl: stored!.url,
                pdfOriginalSha256: stored!.sha256,
                situacao:
                  existing.situacao === DocumentoSituacao.RASCUNHO ||
                  existing.situacao === DocumentoSituacao.GERADO
                    ? DocumentoSituacao.SEM_ASSINATURA_EXTERNA
                    : existing.situacao,
              }
            : {}),
        },
        include: DOCUMENTO_INCLUDE,
      });
      return this.serialize(updated);
    }

    const codigo = await this.nextCodigo();
    const codigoValidacao = this.nextCodigoValidacao();
    const codigoVerificador = generateCodigoVerificador(codigo, codigoValidacao);
    const created = await this.prisma.documento.create({
      data: {
        codigo,
        codigoValidacao,
        tipo: DocumentoTipo.RELATORIO_EXECUCAO,
        situacao: stored ? DocumentoSituacao.SEM_ASSINATURA_EXTERNA : DocumentoSituacao.GERADO,
        origem: DocumentoOrigem.CHAMADO_EXECUCAO,
        titulo: input.titulo,
        descricao: input.descricao ?? null,
        secretariaId: input.secretariaId,
        unidadeId: input.unidadeId ?? null,
        chamadoId: input.chamadoId,
        enderecoTexto: input.enderecoTexto ?? null,
        checklistVersaoId: input.checklistVersaoId ?? null,
        responsavelId: input.responsavelId ?? null,
        criadoPorId: input.criadoPorId ?? null,
        pdfOriginalStorageKey: stored?.storageKey ?? null,
        pdfOriginalUrl: stored?.url ?? null,
        pdfOriginalSha256: stored?.sha256 ?? null,
        metadata: {
          codigoVerificador,
          ...(input.metadata ?? {}),
          ...(stored ? { origemPdf: 'relatorio_execucao' } : {}),
        } as Prisma.InputJsonValue,
      },
      include: DOCUMENTO_INCLUDE,
    });

    await this.registrarHistorico(
      created.id,
      null,
      created.situacao,
      'Documento gerado a partir de execução de chamado',
      input.criadoPorId ?? null,
    );

    return this.serialize(created);
  }

  /**
   * Validação pública por código de validação (link/QR) + código verificador.
   */
  async validarPublico(codigoValidacao: string, codigoVerificador?: string | null) {
    const codigo = codigoValidacao.trim().toUpperCase();
    if (!codigo) throw new NotFoundException('Código de validação inválido.');

    const provided = (codigoVerificador ?? '').trim().toUpperCase();
    if (!provided) {
      throw new BadRequestException('Informe o código verificador para confirmar a autenticidade.');
    }

    const documento = await this.prisma.documento.findFirst({
      where: { codigoValidacao: codigo },
      include: this.publicValidacaoInclude(),
    });

    if (!documento) throw new NotFoundException('Documento não encontrado para este código.');

    if (!verifyCodigoVerificador(documento.codigo, documento.codigoValidacao, provided)) {
      throw new NotFoundException('Código verificador inválido para este documento.');
    }

    return this.serializeValidacaoPublica(documento, true);
  }

  /**
   * Validação pública manual por código do documento + código verificador
   * (sem exigir digitação do código de validação longo).
   */
  async validarPublicoPorDocumento(codigoDocumento: string, codigoVerificador?: string | null) {
    const codigo = codigoDocumento.trim().toUpperCase();
    if (!codigo || codigo.length < 6) {
      throw new BadRequestException('Informe o código do documento.');
    }

    const provided = (codigoVerificador ?? '').trim().toUpperCase();
    if (!provided) {
      throw new BadRequestException('Informe o código verificador para confirmar a autenticidade.');
    }

    const documento = await this.prisma.documento.findFirst({
      where: { codigo },
      include: this.publicValidacaoInclude(),
    });

    // Resposta genérica: não confirma existência sem o verificador correto.
    if (!documento || !verifyCodigoVerificador(documento.codigo, documento.codigoValidacao, provided)) {
      throw new NotFoundException('Documento não encontrado ou código verificador inválido.');
    }

    return this.serializeValidacaoPublica(documento, true);
  }

  private publicValidacaoInclude() {
    return {
      secretaria: { select: { sigla: true, nome: true } },
      unidade: { select: { nome: true, codigoPatrimonial: true } },
      chamado: { select: { codigo: true, excluidoEm: true } },
      chamadosVinculados: {
        select: { chamado: { select: { codigo: true, excluidoEm: true } } },
      },
      fiscalizacao: {
        select: {
          id: true,
          concluidaEm: true,
          unidade: { select: { nome: true, codigoPatrimonial: true } },
        },
      },
      assinaturas: {
        where: { invalida: false },
        orderBy: { coletadaEm: 'desc' as const },
        select: {
          assinanteNome: true,
          assinanteDocumento: true,
          assinanteEmail: true,
          qualificacao: true,
          coletadaEm: true,
          canal: true,
          metadata: true,
        },
      },
    };
  }

  private serializeValidacaoPublica(
    documento: {
      codigo: string;
      codigoValidacao: string;
      tipo: DocumentoTipo;
      situacao: DocumentoSituacao;
      titulo: string;
      createdAt: Date;
      pdfOriginalStorageKey: string | null;
      pdfAssinadoStorageKey: string | null;
      pdfOriginalSha256: string | null;
      pdfAssinadoSha256: string | null;
      secretaria: { sigla: string; nome: string };
      unidade: { nome: string; codigoPatrimonial: string } | null;
      chamado: { codigo: string; excluidoEm?: Date | null } | null;
      chamadosVinculados?: Array<{ chamado: { codigo: string; excluidoEm?: Date | null } | null }>;
      fiscalizacao: {
        id: string;
        concluidaEm: Date | null;
        unidade: { nome: string; codigoPatrimonial: string } | null;
      } | null;
      assinaturas: Array<{
        assinanteNome: string;
        assinanteDocumento: string | null;
        assinanteEmail: string | null;
        qualificacao: string | null;
        coletadaEm: Date;
        canal: string;
        metadata?: unknown;
      }>;
    },
    verificadorConfirmado: boolean,
  ) {
    const expectedVerificador = generateCodigoVerificador(documento.codigo, documento.codigoValidacao);
    return {
      codigo: documento.codigo,
      codigoValidacao: documento.codigoValidacao,
      codigoVerificador: expectedVerificador,
      verificadorConfirmado,
      tipo: documento.tipo,
      situacao: documento.situacao,
      titulo: documento.titulo,
      secretaria: documento.secretaria,
      unidade: documento.unidade,
      chamadoCodigo: codigosChamadosPublicos(documento),
      vistoriaLabel: documento.fiscalizacao
        ? `${documento.fiscalizacao.unidade?.codigoPatrimonial ?? ''} ${documento.fiscalizacao.unidade?.nome ?? 'Vistoria'}`.trim()
        : null,
      criadoEm: documento.createdAt.toISOString(),
      possuiPdfOriginal: Boolean(documento.pdfOriginalStorageKey),
      possuiPdfAssinado: Boolean(documento.pdfAssinadoStorageKey),
      pdfOriginalSha256: documento.pdfOriginalSha256
        ? `${documento.pdfOriginalSha256.slice(0, 16)}…`
        : null,
      pdfAssinadoSha256: documento.pdfAssinadoSha256
        ? `${documento.pdfAssinadoSha256.slice(0, 16)}…`
        : null,
      assinaturas: documento.assinaturas.map((item) => {
        const meta = this.asRecord(
          (item as { metadata?: unknown }).metadata,
        );
        return {
          assinanteNome: item.assinanteNome,
          assinanteDocumento: displayAssinanteCpf({
            cpf: item.assinanteDocumento,
            cpfNaoInformado: Boolean(meta.cpfNaoInformado),
          }),
          assinanteEmail: displayAssinanteEmail({
            email: item.assinanteEmail,
            emailNaoInformado: Boolean(meta.emailNaoInformado),
          }),
          qualificacao: item.qualificacao,
          coletadaEm: item.coletadaEm.toISOString(),
          canal: item.canal,
          cpfNaoInformado: Boolean(meta.cpfNaoInformado),
          emailNaoInformado: Boolean(meta.emailNaoInformado),
        };
      }),
      valido:
        documento.situacao === DocumentoSituacao.ASSINADO_VIGENTE ||
        documento.situacao === DocumentoSituacao.SEM_ASSINATURA_EXTERNA ||
        documento.situacao === DocumentoSituacao.GERADO ||
        documento.situacao === DocumentoSituacao.ASSINATURA_PENDENTE,
    };
  }

  private async saveRespostasInternal(
    documentoId: string,
    respostas: DocumentoRespostaItemDto[],
    user: JwtPayload,
    options?: { skipLockCheck?: boolean },
  ) {
    const documento = await this.requireDocumentoFull(documentoId, user);
    if (!options?.skipLockCheck) {
      this.assertConteudoEditavel(documento);
    }
    if (!documento.checklistVersaoId) {
      throw new BadRequestException('Documento sem checklist vinculado.');
    }

    const itens = await this.prisma.checklistItem.findMany({
      where: { checklistVersaoId: documento.checklistVersaoId, ativo: true },
      orderBy: { ordem: 'asc' },
    });
    const itemById = new Map(itens.map((item) => [item.id, item]));

    for (const resposta of respostas) {
      if (!itemById.has(resposta.itemId)) {
        throw new BadRequestException('Item de checklist inválido para este documento.');
      }
    }

    const evidenciasPorItem = this.readEvidenciasPorItem(documento.metadata);

    for (const resposta of respostas) {
      const urls = resposta.evidenciaDataUrls?.filter((url) => url?.startsWith('data:')) ?? [];
      if (!urls.length) continue;
      const storedList: EvidenciaStored[] = [];
      for (const url of urls) {
        const stored = await this.storageService.persistEvidenceUrl(url);
        storedList.push({
          storageKey: stored.storageKey,
          url: stored.url,
          mimeType: stored.mimeType,
          checksum: stored.checksum,
          tamanhoBytes: stored.tamanhoBytes,
        });
      }
      evidenciasPorItem[resposta.itemId] = [
        ...(evidenciasPorItem[resposta.itemId] ?? []),
        ...storedList,
      ];
    }

    // Rascunho pode ser parcial. Itens obrigatórios são validados só na conclusão.
    await this.prisma.$transaction(async (tx) => {
      for (const resposta of respostas) {
        await tx.documentoResposta.upsert({
          where: {
            documentoId_itemId: {
              documentoId,
              itemId: resposta.itemId,
            },
          },
          create: {
            documentoId,
            itemId: resposta.itemId,
            conformidade: resposta.conformidade ?? null,
            valorTexto: resposta.valorTexto?.trim() || null,
            valorNumero: resposta.valorNumero ?? null,
            valorBooleano: resposta.valorBooleano ?? null,
            comentario: resposta.comentario?.trim() || null,
            respondidoEm: new Date(),
          },
          update: {
            conformidade: resposta.conformidade ?? null,
            valorTexto: resposta.valorTexto?.trim() || null,
            valorNumero: resposta.valorNumero ?? null,
            valorBooleano: resposta.valorBooleano ?? null,
            comentario: resposta.comentario?.trim() || null,
            respondidoEm: new Date(),
          },
        });
      }

      await tx.documento.update({
        where: { id: documentoId },
        data: {
          metadata: {
            ...this.asRecord(documento.metadata),
            evidenciasPorItem,
            codigoVerificador:
              this.asRecord(documento.metadata).codigoVerificador ??
              generateCodigoVerificador(documento.codigo, documento.codigoValidacao),
          } as Prisma.InputJsonValue,
        },
      });
    });

    await this.audit(user.sub, AuditAction.UPDATE, documentoId, null, {
      respostasCount: respostas.length,
    });
  }

  private async buildRelatorioExecucaoFromDocumento(documento: DocumentoLoaded) {
    if (!documento.chamadoId) {
      throw new BadRequestException('Documento de execução sem chamado vinculado.');
    }

    const chamado = await this.prisma.chamado.findUnique({
      where: { id: documento.chamadoId },
      select: {
        id: true,
        codigo: true,
        status: true,
        enderecoTexto: true,
        secretaria: { select: { nome: true, sigla: true } },
        unidade: {
          select: { nome: true, codigoPatrimonial: true, endereco: true },
        },
        tipoChamado: { select: { nome: true } },
        responsavel: { select: { nome: true } },
        equipe: { select: { nome: true } },
      },
    });
    if (!chamado) throw new NotFoundException('Chamado vinculado não encontrado.');

    const meta = this.asRecord(documento.metadata);
    const historicoId = typeof meta.historicoExecucaoId === 'string' ? meta.historicoExecucaoId : null;
    const historico = historicoId
      ? await this.prisma.historicoStatus.findUnique({ where: { id: historicoId } })
      : await this.prisma.historicoStatus.findFirst({
          where: {
            entidadeTipo: 'Chamado',
            entidadeId: chamado.id,
            OR: [
              { metadata: { path: ['tipo'], equals: 'execucao_conclusao' } },
              { metadata: { path: ['tipo'], equals: 'execucao_manual' } },
            ],
          },
          orderBy: { createdAt: 'desc' },
        });

    const histMeta = this.asRecord(historico?.metadata);
    const evidenciaIds = Array.isArray(histMeta.evidenciaIds)
      ? histMeta.evidenciaIds.filter((item): item is string => typeof item === 'string')
      : Array.isArray(meta.evidenciaIds)
        ? meta.evidenciaIds.filter((item): item is string => typeof item === 'string')
        : [];

    const evidencias = evidenciaIds.length
      ? await this.prisma.evidencia.findMany({
          where: { id: { in: evidenciaIds }, chamadoId: chamado.id },
          orderBy: { capturadaEm: 'asc' },
          select: { mimeType: true, storageKey: true, url: true, metadata: true },
        })
      : [];

    const evidenciasGerais = [];
    for (let index = 0; index < evidencias.length; index++) {
      const evidencia = evidencias[index];
      const storageKey = evidencia.storageKey ?? extractStorageKeyFromUrl(evidencia.url);
      let imageBuffer: Buffer | null = null;
      if (storageKey && isPdfRenderableImage(evidencia.mimeType)) {
        const loaded = await this.storageService.readObjectBuffer(storageKey, evidencia.mimeType);
        imageBuffer = loaded?.buffer
          ? (await shrinkImageForPdf(loaded.buffer, loaded.mimeType || 'image/jpeg')).buffer
          : null;
      }
      const evMeta = this.asRecord(evidencia.metadata);
      evidenciasGerais.push({
        legenda:
          (typeof evMeta.descricao === 'string' && evMeta.descricao) ||
          (typeof evMeta.nome === 'string' && evMeta.nome) ||
          `Evidência ${index + 1}`,
        mimeType: evidencia.mimeType,
        nomeArquivo: storageKey?.split('/').pop() ?? null,
        imageBuffer,
      });
    }

    const checklistComplementar = this.asRecord(histMeta.checklistComplementar);
    const respostasRaw = Array.isArray(checklistComplementar.respostas)
      ? checklistComplementar.respostas
      : [];
    const respostas = [];
    for (const raw of respostasRaw) {
      const item = this.asRecord(raw);
      const evidenciaUrls = Array.isArray(item.evidenciaUrls)
        ? item.evidenciaUrls.filter((url): url is string => typeof url === 'string')
        : [];
      const evidenciasItem: Array<{
        legenda: string;
        mimeType: string | null;
        nomeArquivo: string | null;
        imageBuffer: Buffer | null;
      }> = [];
      for (let index = 0; index < evidenciaUrls.length; index++) {
        const url = evidenciaUrls[index];
        let mimeType: string | null = null;
        let nomeArquivo: string | null = url.startsWith('data:')
          ? null
          : url.split('/').pop() ?? null;
        let imageBuffer: Buffer | null = null;

        if (url.startsWith('data:')) {
          const match = /^data:([^;]+);base64,(.+)$/i.exec(url);
          if (match && isPdfRenderableImage(match[1])) {
            mimeType = match[1];
            imageBuffer = Buffer.from(match[2], 'base64');
          }
        } else {
          const storageKey = extractStorageKeyFromUrl(url);
          if (storageKey) {
            const loaded = await this.storageService.readObjectBuffer(storageKey);
            mimeType = loaded?.mimeType ?? null;
            nomeArquivo = storageKey.split('/').pop() ?? null;
            imageBuffer =
              loaded?.buffer && isPdfRenderableImage(loaded.mimeType) ? loaded.buffer : null;
          }
        }

        evidenciasItem.push({
          legenda: `Evidência da pergunta ${index + 1}`,
          mimeType,
          nomeArquivo,
          imageBuffer,
        });
      }

      const naoSeAplica = Boolean(item.naoSeAplica);
      let respostaTexto = '—';
      if (naoSeAplica) respostaTexto = 'Não se aplica';
      else if (typeof item.valorBooleano === 'boolean') respostaTexto = item.valorBooleano ? 'Sim' : 'Não';
      else if (item.valorNumero != null) respostaTexto = String(item.valorNumero);
      else if (typeof item.valorTexto === 'string' && item.valorTexto.trim()) respostaTexto = item.valorTexto.trim();

      respostas.push({
        codigo: typeof item.codigo === 'string' ? item.codigo : String(item.itemId ?? ''),
        titulo: typeof item.titulo === 'string' ? item.titulo : 'Item',
        tipo: typeof item.tipo === 'string' ? item.tipo : null,
        respostaTexto,
        comentario: typeof item.comentario === 'string' ? item.comentario : null,
        conformidade: null,
        naoSeAplica,
        evidencias: evidenciasItem,
      });
    }

    const participantes = Array.isArray(histMeta.participantes)
      ? histMeta.participantes
          .map((item) => this.asRecord(item))
          .map((item) => (typeof item.nome === 'string' ? item.nome : null))
          .filter((nome): nome is string => Boolean(nome))
          .join(', ')
      : null;
    const equipeMeta = this.asRecord(histMeta.equipeExecutora);
    const checklistNome =
      (typeof checklistComplementar.checklistNome === 'string' && checklistComplementar.checklistNome) ||
      (typeof meta.checklistNome === 'string' && meta.checklistNome) ||
      documento.checklistVersao?.checklist?.nome ||
      null;

    return buildRelatorioExecucaoPdf({
      documentoCodigo: documento.codigo,
      chamadoCodigo: chamado.codigo,
      tipoChamadoNome: chamado.tipoChamado?.nome ?? null,
      secretariaLabel: chamado.secretaria
        ? `${formatSecretariaLabel(chamado.secretaria)}`
        : '—',
      localLabel: chamado.unidade
        ? `${chamado.unidade.codigoPatrimonial ?? ''} ${chamado.unidade.nome}`.trim()
        : chamado.enderecoTexto || 'Local livre',
      endereco: chamado.enderecoTexto || chamado.unidade?.endereco || null,
      statusLabel: chamado.status,
      responsavelLabel: chamado.responsavel?.nome ?? documento.responsavel?.nome ?? null,
      equipeLabel:
        (typeof equipeMeta.nome === 'string' && equipeMeta.nome) || chamado.equipe?.nome || null,
      executadoEm: historico
        ? new Date(historico.createdAt).toLocaleString('pt-BR')
        : new Date(documento.createdAt).toLocaleString('pt-BR'),
      registradoPorLabel: documento.criadoPor?.nome ?? null,
      origemExecucaoLabel:
        histMeta.tipo === 'execucao_manual' ? 'Lançamento manual' : 'Execução em campo',
      relatorio:
        (typeof histMeta.relatorio === 'string' && histMeta.relatorio) ||
        documento.descricao ||
        '—',
      impedimento: Boolean(histMeta.impedimento),
      impedimentoMotivo:
        typeof histMeta.impedimentoMotivo === 'string' ? histMeta.impedimentoMotivo : null,
      participantesLabel: participantes,
      checklistNome,
      checklistVersao: documento.checklistVersao?.versao ?? null,
      respostas,
      evidenciasGerais,
    });
  }

  private async buildDocumentoPdfBuffer(
    documento: DocumentoLoaded,
    options: { incluirAssinaturas: boolean; incluirBlocoAutenticidade?: boolean },
  ) {
    const codigoVerificador = generateCodigoVerificador(documento.codigo, documento.codigoValidacao);
    const validationUrl = buildPublicValidationUrl(documento.codigoValidacao, codigoVerificador);
    const evidenciasPorItem = this.readEvidenciasPorItem(documento.metadata);

    const respostasOrdenadas = [...documento.respostas].sort(
      (a, b) => (a.item?.ordem ?? 0) - (b.item?.ordem ?? 0),
    );

    const respostasPdf: DocumentoPdfResposta[] = [];
    for (const resposta of respostasOrdenadas) {
      const evidenciasMeta = evidenciasPorItem[resposta.itemId] ?? [];
      const evidencias = [];
      for (let index = 0; index < evidenciasMeta.length; index++) {
        const evidencia = evidenciasMeta[index];
        let imageBuffer: Buffer | null = null;
        if (evidencia.storageKey) {
          const loaded = await this.storageService.readObjectBuffer(
            evidencia.storageKey,
            evidencia.mimeType,
          );
          imageBuffer = loaded?.buffer
          ? (await shrinkImageForPdf(loaded.buffer, loaded.mimeType || 'image/jpeg')).buffer
          : null;
        }
        evidencias.push({
          legenda: `Evidência ${index + 1}`,
          mimeType: evidencia.mimeType,
          nomeArquivo: evidencia.storageKey?.split('/').pop() ?? null,
          imageBuffer,
        });
      }

      respostasPdf.push({
        codigo: resposta.item?.codigo ?? resposta.itemId.slice(0, 8),
        secao: resposta.item?.secao ?? null,
        titulo: resposta.item?.titulo ?? 'Item',
        tipo: resposta.item?.tipo ?? 'TEXTO',
        respostaTexto: this.formatRespostaTexto(resposta),
        comentario: resposta.comentario,
        conformidade: resposta.conformidade,
        evidencias,
      });
    }

    let assinaturasPdf: DocumentoPdfAssinatura[] | undefined;
    if (options.incluirAssinaturas) {
      const validas = documento.assinaturas.filter((item) => !item.invalida);
      assinaturasPdf = [];
      for (const assinatura of validas) {
        let imageBuffer: Buffer | null = null;
        if (assinatura.evidenciaStorageKey) {
          const loaded = await this.storageService.readObjectBuffer(
            assinatura.evidenciaStorageKey,
            'image/png',
          );
          imageBuffer = loaded?.buffer
          ? (await shrinkImageForPdf(loaded.buffer, loaded.mimeType || 'image/jpeg')).buffer
          : null;
        }
        const meta = this.asRecord(assinatura.metadata);
        assinaturasPdf.push({
          assinanteNome: assinatura.assinanteNome,
          assinanteDocumento: displayAssinanteCpf({
            cpf: assinatura.assinanteDocumento,
            cpfNaoInformado: Boolean(meta.cpfNaoInformado),
          }),
          assinanteEmail: displayAssinanteEmail({
            email: assinatura.assinanteEmail,
            emailNaoInformado: Boolean(meta.emailNaoInformado),
          }),
          qualificacao: assinatura.qualificacaoOutro?.trim() || assinatura.qualificacao,
          coletadaEm: assinatura.coletadaEm.toISOString(),
          imageBuffer,
        });
      }
    }

    return buildDocumentoPdf({
      codigo: documento.codigo,
      codigoValidacao: documento.codigoValidacao,
      codigoVerificador,
      tipoLabel: TIPO_LABELS[documento.tipo] ?? documento.tipo,
      situacaoLabel: SITUACAO_LABELS[documento.situacao] ?? documento.situacao,
      origemLabel: ORIGEM_LABELS[documento.origem] ?? documento.origem,
      titulo: documento.titulo,
      secretariaLabel: documento.secretaria
        ? `${formatSecretariaLabel(documento.secretaria)}`
        : '—',
      unidadeLabel: documento.unidade
        ? `${documento.unidade.codigoPatrimonial ?? ''} ${documento.unidade.nome}`.trim()
        : null,
      endereco: documento.enderecoTexto || documento.unidade?.endereco || null,
      chamadoCodigo: this.chamadosDoDocumento(documento).map((item) => item.codigo).join(', ') || null,
      vistoriaLabel: documento.fiscalizacao
        ? `Vistoria ${documento.fiscalizacao.id.slice(0, 8)}`
        : null,
      checklistLabel: documento.checklistVersao
        ? `${documento.checklistVersao.checklist?.nome ?? 'Checklist'} v${documento.checklistVersao.versao}`
        : null,
      responsavelLabel: documento.responsavel?.nome ?? null,
      criadoEm: documento.createdAt.toISOString(),
      geradoEm: new Date().toISOString(),
      validationUrl,
      hashResumo: documento.pdfOriginalSha256,
      respostas: respostasPdf,
      assinaturas: assinaturasPdf,
      incluirAssinaturas: options.incluirAssinaturas,
      incluirBlocoAutenticidade: options.incluirBlocoAutenticidade !== false,
    });
  }

  private async requireChecklistAvulsoVersao(checklistVersaoId: string) {
    const versao = await this.prisma.checklistVersao.findFirst({
      where: { id: checklistVersaoId },
      include: {
        checklist: {
          select: {
            id: true,
            nome: true,
            ativo: true,
            finalidade: true,
            finalidades: true,
          },
        },
        itens: {
          where: { ativo: true },
          orderBy: { ordem: 'asc' },
        },
      },
    });

    if (!versao || versao.status !== ChecklistVersaoStatus.PUBLICADA) {
      throw new BadRequestException('Somente versões publicadas podem ser usadas em documento avulso.');
    }
    if (!versao.checklist.ativo) {
      throw new BadRequestException('Checklist inativo.');
    }

    const finalidades = versao.checklist.finalidades ?? [];
    const ok =
      versao.checklist.finalidade === ChecklistFinalidade.DOCUMENTO_AVULSO ||
      finalidades.includes(ChecklistFinalidade.DOCUMENTO_AVULSO);
    if (!ok) {
      throw new BadRequestException(
        'Checklist não possui finalidade DOCUMENTO_AVULSO e não pode ser usado em documento avulso.',
      );
    }

    return versao;
  }

  private assertConteudoEditavel(documento: {
    situacao: DocumentoSituacao;
    conteudoTravadoEm: Date | null;
  }) {
    if (documento.conteudoTravadoEm) {
      throw new BadRequestException('Conteúdo do documento está travado após assinatura.');
    }
    if (documento.situacao === DocumentoSituacao.ASSINADO_VIGENTE) {
      throw new BadRequestException('Documento assinado vigente não permite alteração de conteúdo.');
    }
    if (
      documento.situacao === DocumentoSituacao.CANCELADO ||
      documento.situacao === DocumentoSituacao.SUBSTITUIDO ||
      documento.situacao === DocumentoSituacao.INVALIDO
    ) {
      throw new BadRequestException('Documento não permite edição nesta situação.');
    }
  }

  private assertSecretariaNoEscopo(user: JwtPayload, secretariaId: string) {
    const scope = resolveDirectSecretariaFilter(user);
    if ('id' in scope && Array.isArray((scope as { id: { in: string[] } }).id?.in)) {
      throw new ForbiddenException('Sem secretaria autorizada.');
    }
    if ('secretariaId' in scope && scope.secretariaId) {
      const allowed =
        typeof scope.secretariaId === 'string'
          ? [scope.secretariaId]
          : scope.secretariaId.in;
      if (!allowed.includes(secretariaId)) {
        throw new ForbiddenException('Secretaria fora do escopo autorizado.');
      }
    }
  }

  private buildWhere(query: ListDocumentosQueryDto, user: JwtPayload): Prisma.DocumentoWhereInput {
    const and: Prisma.DocumentoWhereInput[] = [this.scopeFilter(user)];

    if (query.tipo) and.push({ tipo: query.tipo });
    if (query.situacao) and.push({ situacao: query.situacao });
    if (query.origem) and.push({ origem: query.origem });
    if (query.secretariaId) and.push({ secretariaId: query.secretariaId });
    if (query.unidadeId) and.push({ unidadeId: query.unidadeId });
    if (query.chamadoId) {
      and.push({
        OR: [
          { chamadoId: query.chamadoId },
          { chamadosVinculados: { some: { chamadoId: query.chamadoId } } },
        ],
      });
    } else {
      and.push({
        OR: [
          { AND: [{ chamadoId: null }, { chamadosVinculados: { none: {} } }] },
          { chamado: { is: { excluidoEm: null } } },
          { chamadosVinculados: { some: { chamado: { is: { excluidoEm: null } } } } },
        ],
      });
    }
    if (query.fiscalizacaoId) and.push({ fiscalizacaoId: query.fiscalizacaoId });
    if (query.responsavelId) and.push({ responsavelId: query.responsavelId });

    if (query.from || query.to) {
      and.push({
        createdAt: {
          ...(query.from ? { gte: new Date(query.from) } : {}),
          ...(query.to ? { lte: new Date(query.to) } : {}),
        },
      });
    }

    const assinatura = query.assinatura?.trim().toLowerCase();
    if (assinatura === 'pendente') {
      and.push({ situacao: DocumentoSituacao.ASSINATURA_PENDENTE });
    } else if (assinatura === 'assinado') {
      and.push({ situacao: DocumentoSituacao.ASSINADO_VIGENTE });
    } else if (assinatura === 'cancelado') {
      and.push({ situacao: DocumentoSituacao.CANCELADO });
    } else if (assinatura === 'substituido') {
      and.push({ situacao: DocumentoSituacao.SUBSTITUIDO });
    }

    if (query.avulso === '1' || query.avulso === 'true') {
      and.push({ origem: DocumentoOrigem.AVULSO });
    }

    if (query.pendentesAssinatura === '1' || query.assinatura === 'minha') {
      and.push({
        assinaturaPedidos: {
          some: { destinatarioId: user.sub, status: DocumentoAssinaturaPedidoStatus.PENDENTE },
        },
      });
    }

    const search = query.search?.trim();
    if (search) {
      and.push({
        OR: [
          { codigo: { contains: search, mode: 'insensitive' } },
          { codigoValidacao: { contains: search, mode: 'insensitive' } },
          { titulo: { contains: search, mode: 'insensitive' } },
          { enderecoTexto: { contains: search, mode: 'insensitive' } },
          { chamado: { codigo: { contains: search, mode: 'insensitive' } } },
          { chamado: { titulo: { contains: search, mode: 'insensitive' } } },
          { chamadosVinculados: { some: { chamado: { codigo: { contains: search, mode: 'insensitive' } } } } },
          { chamadosVinculados: { some: { chamado: { titulo: { contains: search, mode: 'insensitive' } } } } },
          { unidade: { nome: { contains: search, mode: 'insensitive' } } },
          { unidade: { codigoPatrimonial: { contains: search, mode: 'insensitive' } } },
        ],
      });
    }

    return { AND: and };
  }

  private scopeFilter(user: JwtPayload): Prisma.DocumentoWhereInput {
    return resolveDirectSecretariaFilter(user) as Prisma.DocumentoWhereInput;
  }

  private async requireDocumento(id: string, user: JwtPayload) {
    const documento = await this.prisma.documento.findFirst({
      where: { id, ...this.scopeFilter(user) },
    });
    if (!documento) throw new NotFoundException('Documento não encontrado.');
    return documento;
  }

  /** Escopo do módulo, pedido de assinatura ou elaborador. Destinatário vê só o documento encaminhado. */
  private async requireDocumentoVisivel(id: string, user: JwtPayload) {
    const modulo =
      isAdministradorSistema(user) ||
      hasDocumentosModuloAccess(user.permissoes) ||
      hasAnyPermission(user, ['documentos.visualizar', 'documentos.administrar']);
    if (modulo) {
      const noEscopo = await this.prisma.documento.findFirst({
        where: { id, ...this.scopeFilter(user) },
      });
      if (noEscopo) return noEscopo;
    }
    const documento = await this.prisma.documento.findFirst({ where: { id } });
    if (!documento) throw new NotFoundException('Documento não encontrado.');
    const pedido = await this.prisma.documentoAssinaturaPedido.findFirst({
      where: { documentoId: id, destinatarioId: user.sub },
      select: { id: true },
    });
    const elaborador = documento.criadoPorId === user.sub || documento.responsavelId === user.sub;
    if (!pedido && !elaborador) throw new NotFoundException('Documento não encontrado.');
    return documento;
  }

  private async requireDocumentoFull(id: string, user: JwtPayload) {
    const documento = await this.prisma.documento.findFirst({
      where: { id, ...this.scopeFilter(user) },
      include: DOCUMENTO_INCLUDE,
    });
    if (!documento) throw new NotFoundException('Documento não encontrado.');
    return documento;
  }

  private async requireDocumentoFullById(id: string) {
    const documento = await this.prisma.documento.findFirst({
      where: { id },
      include: DOCUMENTO_INCLUDE,
    });
    if (!documento) throw new NotFoundException('Documento não encontrado.');
    return documento;
  }

  private async nextCodigo() {
    const ano = new Date().getFullYear();
    const seq = await this.prisma.$transaction(async (tx) => {
      const current = await tx.documentoSequencia.upsert({
        where: { ano },
        update: { ultimo: { increment: 1 } },
        create: { ano, ultimo: 1 },
      });
      return current.ultimo;
    });
    return `DOC-${ano}-${String(seq).padStart(6, '0')}`;
  }

  private async listRelated(query: ListDocumentosQueryDto, user: JwtPayload) {
    const limit = Math.min(Math.max(Number(query.limit) || 50, 1), 200);
    const offset = Math.max(Number(query.offset) || 0, 0);
    const where = this.buildWhere(query, user);

    const [total, items] = await Promise.all([
      this.prisma.documento.count({ where }),
      this.prisma.documento.findMany({
        where,
        include: DOCUMENTO_INCLUDE,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
    ]);

    return {
      total,
      items: items.map((item) => this.serialize(item)),
    };
  }

  private nextCodigoValidacao() {
    return generateCodigoValidacao();
  }

  private assertCanVisualizarModulo(user: JwtPayload) {
    if (hasDocumentosModuloAccess(user.permissoes)) return;
    throw new ForbiddenException('Sem permissão para abrir o cadastro do documento.');
  }

  private assertCanVisualizarRelacionado(user: JwtPayload) {
    if (!hasDocumentosRelacionadosAccess(user.permissoes)) {
      throw new ForbiddenException('Sem permissão para visualizar documentos relacionados.');
    }
    const operacional = hasAnyPermission(user, [
      'chamados.gerenciar',
      'chamados.executar',
      'fiscalizacoes.executar',
      'usuarios.gerenciar',
      'documentos.visualizar',
      'documentos.administrar',
    ]);
    if (!operacional && !hasDocumentosModuloAccess(user.permissoes)) {
      const caps = resolveMeusChamadosTimelineCaps(user.permissoes);
      if (!caps.consultarDocumentos) {
        throw new ForbiddenException('Sem permissão para consultar documentos relacionados.');
      }
    }
  }

  private assertCanVisualizar(user: JwtPayload) {
    this.assertCanVisualizarRelacionado(user);
  }

  private assertPermission(user: JwtPayload, keys: string[]) {
    if (user.permissoes.includes('usuarios.gerenciar') || user.permissoes.includes('documentos.administrar')) {
      return;
    }
    if (keys.some((key) => user.permissoes.includes(key))) return;
    throw new ForbiddenException('Sem permissão para esta ação em documentos.');
  }

  private async registrarHistorico(
    documentoId: string,
    statusAnterior: string | null,
    statusNovo: string,
    motivo: string,
    alteradoPorId: string | null,
    metadata?: Record<string, unknown>,
  ) {
    await this.prisma.historicoStatus.create({
      data: {
        entidadeTipo: 'DOCUMENTO',
        entidadeId: documentoId,
        statusAnterior,
        statusNovo,
        motivo,
        alteradoPorId,
        metadata: (metadata ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    });
  }

  private async audit(
    usuarioId: string,
    acao: AuditAction,
    entidadeId: string,
    valorAntigo: unknown,
    valorNovo: unknown,
    extra?: {
      perfilAtivoNome?: string | null;
      secretariaAtivaId?: string | null;
      secretariaAtivaSigla?: string | null;
      descricao?: string;
    },
  ) {
    await this.prisma.logAuditoria.create({
      data: {
        usuarioId,
        acao,
        entidadeTipo: 'Documento',
        entidadeId,
        valorAntigo: (valorAntigo ?? undefined) as Prisma.InputJsonValue | undefined,
        valorNovo: (valorNovo ?? undefined) as Prisma.InputJsonValue | undefined,
        perfilAtivoNome: extra?.perfilAtivoNome ?? null,
        secretariaAtivaId: extra?.secretariaAtivaId ?? null,
        secretariaAtivaSigla: extra?.secretariaAtivaSigla ?? null,
        descricao: extra?.descricao ?? null,
        tela: extra ? 'documentos' : null,
        funcao: extra ? 'editar_vinculo' : null,
      },
    });
  }

  private normalizarChamadoIds(chamadoIds?: string[] | null, chamadoId?: string | null) {
    const ids = [...(chamadoIds ?? [])];
    if (chamadoId) ids.push(chamadoId);
    return [...new Set(ids.map((item) => item.trim()).filter(Boolean))];
  }

  private whereChamadoVinculavel(user: JwtPayload): Prisma.ChamadoWhereInput {
    if (isAdministradorSistema(user) || user.permissoes.includes('documentos.administrar')) {
      return { excluidoEm: null };
    }
    return { excluidoEm: null, ...resolveChamadoSecretariaFilter(user) };
  }

  private assertPodeBuscarChamados(user: JwtPayload) {
    if (isAdministradorSistema(user)) return;
    this.assertPermission(user, [
      'documentos.visualizar',
      'documentos.criar_avulso',
      'documentos.editar_vinculo',
      'documentos.administrar',
    ]);
  }

  private podeVincularChamadosAvulso(
    documento: { situacao: DocumentoSituacao; origem: DocumentoOrigem },
    user: JwtPayload,
  ) {
    if (documento.origem !== DocumentoOrigem.AVULSO) return false;
    if (isAdministradorSistema(user) || user.permissoes.includes('documentos.administrar') || user.permissoes.includes('usuarios.gerenciar')) {
      return true;
    }
    if (documento.situacao === DocumentoSituacao.RASCUNHO) {
      return (
        user.permissoes.includes('documentos.criar_avulso') ||
        user.permissoes.includes('documentos.editar_vinculo')
      );
    }
    return user.permissoes.includes('documentos.editar_vinculo');
  }

  private assertPodeVincularChamadosAvulso(
    documento: { situacao: DocumentoSituacao; origem: DocumentoOrigem },
    user: JwtPayload,
  ) {
    if (this.podeVincularChamadosAvulso(documento, user)) return;
    if (documento.situacao !== DocumentoSituacao.RASCUNHO) {
      throw new ForbiddenException('Após a conclusão, só um perfil com permissão de editar vínculo pode alterar os chamados.');
    }
    throw new ForbiddenException('Sem permissão para vincular chamados a este documento.');
  }

  private async assertChamadosVinculaveis(ids: string[], user: JwtPayload) {
    if (!ids.length) return [] as Array<{ id: string; codigo: string; titulo: string | null; status: ChamadoStatus }>;
    const encontrados = await this.prisma.chamado.findMany({
      where: { id: { in: ids }, ...this.whereChamadoVinculavel(user) },
      select: { id: true, codigo: true, titulo: true, status: true },
    });
    if (encontrados.length !== ids.length) {
      throw new BadRequestException('Não é possível vincular um chamado que você não pode visualizar.');
    }
    const porId = new Map(encontrados.map((item) => [item.id, item]));
    return ids.map((id) => porId.get(id)!);
  }

  private idsChamadosDoDocumento(documento: {
    chamadoId?: string | null;
    chamado?: { id: string; excluidoEm?: Date | null } | null;
    chamadosVinculados?: Array<{ chamadoId: string; chamado?: { excluidoEm?: Date | null } | null }>;
  }) {
    const ids: string[] = [];
    for (const vinculo of documento.chamadosVinculados ?? []) {
      if (vinculo.chamado?.excluidoEm) continue;
      ids.push(vinculo.chamadoId);
    }
    if (!ids.length && documento.chamadoId && !documento.chamado?.excluidoEm) ids.push(documento.chamadoId);
    return [...new Set(ids)];
  }

  private chamadosDoDocumento(documento: any) {
    const vistos = new Map<string, { id: string; codigo: string; titulo: string | null; status: string }>();
    for (const vinculo of documento.chamadosVinculados ?? []) {
      const chamado = vinculo.chamado;
      if (!chamado || chamado.excluidoEm) continue;
      vistos.set(chamado.id, {
        id: chamado.id,
        codigo: chamado.codigo,
        titulo: chamado.titulo ?? null,
        status: chamado.status,
      });
    }
    if (documento.chamado && !documento.chamado.excluidoEm && !vistos.has(documento.chamado.id)) {
      vistos.set(documento.chamado.id, {
        id: documento.chamado.id,
        codigo: documento.chamado.codigo,
        titulo: documento.chamado.titulo ?? null,
        status: documento.chamado.status,
      });
    }
    return [...vistos.values()];
  }

  private chamadoPrincipal(documento: any) {
    const lista = this.chamadosDoDocumento(documento);
    const primeiro = lista[0];
    if (!primeiro) return null;
    return { id: primeiro.id, codigo: primeiro.codigo, status: primeiro.status };
  }

  private async substituirChamadosVinculados(documentoId: string, chamadoIds: string[], userId: string) {
    await this.prisma.$transaction(async (tx) => {
      await tx.documentoChamado.deleteMany({ where: { documentoId } });
      if (chamadoIds.length) {
        await tx.documentoChamado.createMany({
          data: chamadoIds.map((chamadoId) => ({ documentoId, chamadoId, createdById: userId })),
        });
      }
    });
  }

  private async motivoDiffChamados(
    codigo: string,
    antes: string[],
    depois: Array<{ id: string; codigo: string }>,
  ) {
    const novos = new Set(depois.map((item) => item.id));
    const antigos = new Set(antes);
    const adicionados = depois.filter((item) => !antigos.has(item.id)).map((item) => item.codigo);
    const removidosIds = antes.filter((id) => !novos.has(id));
    const partes = [`Vínculos do documento ${codigo} atualizados`];
    if (adicionados.length) partes.push(`adicionados: ${adicionados.join(', ')}`);
    if (removidosIds.length) {
      const chamadosRemovidos = await this.prisma.chamado.findMany({
        where: { id: { in: removidosIds } },
        select: { codigo: true },
      });
      const codigosRemovidos = chamadosRemovidos.map((c) => c.codigo);
      partes.push(`removidos: ${codigosRemovidos.join(', ')}`);
    }
    return partes.join('. ');
  }

  private async registrarDiffChamadosNaTimeline(
    before: { id: string; codigo: string },
    updated: { id: string; codigo: string },
    antes: string[],
    depois: Array<{ id: string; codigo: string; status: ChamadoStatus }>,
    user: JwtPayload,
    contexto: { perfilAtivoNome: string | null; secretariaAtivaId: string | null; secretariaAtivaSigla: string | null },
  ) {
    const novos = new Set(depois.map((item) => item.id));
    const antigos = new Set(antes);
    for (const chamado of depois) {
      if (antigos.has(chamado.id)) continue;
      await this.registrarVinculoNaTimeline(chamado, updated, user, 'vinculado', contexto);
    }
    const removidos = antes.filter((id) => !novos.has(id));
    if (!removidos.length) return;
    const chamadosRemovidos = await this.prisma.chamado.findMany({
      where: { id: { in: removidos } },
      select: { id: true, codigo: true, status: true },
    });
    for (const chamado of chamadosRemovidos) {
      await this.registrarVinculoNaTimeline(chamado, before, user, 'removido', contexto);
    }
  }

  private async registrarVinculoNaTimeline(
    chamado: { id: string; status: ChamadoStatus; codigo?: string },
    documento: { id: string; codigo: string },
    user: JwtPayload,
    acao: 'vinculado' | 'removido',
    contexto: { perfilAtivoNome: string | null; secretariaAtivaId: string | null; secretariaAtivaSigla: string | null },
  ) {
    const motivo =
      acao === 'vinculado'
        ? `Documento ${documento.codigo} vinculado ao chamado`
        : `Vínculo do documento ${documento.codigo} removido do chamado`;
    await this.prisma.historicoStatus.create({
      data: {
        entidadeTipo: 'Chamado',
        entidadeId: chamado.id,
        statusAnterior: chamado.status,
        statusNovo: chamado.status,
        motivo,
        alteradoPorId: user.sub,
        metadata: {
          tipo: 'documento_vinculo',
          acao,
          documentoId: documento.id,
          documentoCodigo: documento.codigo,
          usuarioNome: user.nome,
          ...contexto,
        },
      },
    });
  }

  private async contextoAtuacao(user: JwtPayload) {
    const [perfil, secretaria] = await Promise.all([
      user.perfilAtivoId
        ? this.prisma.perfil.findUnique({ where: { id: user.perfilAtivoId }, select: { nome: true } })
        : Promise.resolve(null),
      user.secretariaId
        ? this.prisma.secretaria.findUnique({ where: { id: user.secretariaId }, select: { id: true, sigla: true } })
        : Promise.resolve(null),
    ]);
    return {
      perfilAtivoNome: perfil?.nome ?? user.perfis?.[0] ?? null,
      secretariaAtivaId: secretaria?.id ?? user.secretariaId ?? null,
      secretariaAtivaSigla: secretaria?.sigla ?? null,
    };
  }

  private asRecord(value: unknown): Record<string, unknown> {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return { ...(value as Record<string, unknown>) };
    }
    return {};
  }

  private readEvidenciasPorItem(metadata: unknown): Record<string, EvidenciaStored[]> {
    const record = this.asRecord(metadata);
    const raw = record.evidenciasPorItem;
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
    const result: Record<string, EvidenciaStored[]> = {};
    for (const [itemId, list] of Object.entries(raw as Record<string, unknown>)) {
      if (!Array.isArray(list)) continue;
      result[itemId] = list
        .filter((item): item is EvidenciaStored => Boolean(item && typeof item === 'object'))
        .map((item) => ({
          storageKey: String((item as EvidenciaStored).storageKey ?? ''),
          url: String((item as EvidenciaStored).url ?? ''),
          mimeType: String((item as EvidenciaStored).mimeType ?? 'image/jpeg'),
          checksum: (item as EvidenciaStored).checksum,
          tamanhoBytes: (item as EvidenciaStored).tamanhoBytes,
        }))
        .filter((item) => item.storageKey);
    }
    return result;
  }

  private respostaValorTexto(
    resposta: Pick<DocumentoResposta, 'valorTexto' | 'valorNumero' | 'valorBooleano'>,
  ) {
    if (resposta.valorTexto?.trim()) return apresentarValorTexto(resposta.valorTexto);
    if (resposta.valorNumero != null) return String(resposta.valorNumero);
    if (resposta.valorBooleano != null) return String(resposta.valorBooleano);
    return null;
  }

  private formatRespostaTexto(
    resposta: Pick<
      DocumentoResposta,
      'valorTexto' | 'valorNumero' | 'valorBooleano' | 'conformidade'
    >,
  ) {
    if (resposta.valorTexto?.trim()) return apresentarValorTexto(resposta.valorTexto);
    if (resposta.valorNumero != null) return String(resposta.valorNumero);
    if (resposta.valorBooleano === true) return 'Sim';
    if (resposta.valorBooleano === false) return 'Não';
    if (resposta.conformidade) return String(resposta.conformidade);
    return '—';
  }

  private truncateHash(hash?: string | null) {
    if (!hash) return null;
    return hash.length > 16 ? `${hash.slice(0, 16)}…` : hash;
  }

  private canSeeAssinaturasAnteriores(user: JwtPayload) {
    return (
      user.permissoes.includes('documentos.administrar') ||
      user.permissoes.includes('auditoria.visualizar') ||
      user.permissoes.includes('usuarios.gerenciar')
    );
  }

  private snapshotAssinaturaHistorico(item: {
    id: string;
    assinanteNome: string;
    assinanteDocumento?: string | null;
    assinanteEmail?: string | null;
    qualificacao?: string | null;
    qualificacaoOutro?: string | null;
    coletadaEm: Date;
    coletadaPorId?: string | null;
    metadata?: unknown;
  }) {
    const meta = this.asRecord(item.metadata);
    const cpfNaoInformado = Boolean(meta.cpfNaoInformado);
    const emailNaoInformado = Boolean(meta.emailNaoInformado);
    return {
      id: item.id,
      assinanteNome: item.assinanteNome,
      assinanteDocumento: cpfNaoInformado
        ? 'CPF não informado'
        : item.assinanteDocumento ?? 'CPF não informado',
      assinanteEmail: emailNaoInformado
        ? 'E-mail não informado'
        : item.assinanteEmail ?? 'E-mail não informado',
      qualificacao: item.qualificacaoOutro?.trim() || item.qualificacao || null,
      coletadaEm: item.coletadaEm.toISOString(),
      coletadaPorId: item.coletadaPorId ?? null,
      cpfNaoInformado,
      emailNaoInformado,
      justificativaIdentificacao:
        typeof meta.justificativaIdentificacao === 'string'
          ? meta.justificativaIdentificacao
          : null,
    };
  }

  private mapAssinaturaApi(
    item: any,
    opts: { fullPii: boolean },
  ) {
    const meta = this.asRecord(item.metadata);
    const cpfNaoInformado = Boolean(meta.cpfNaoInformado);
    const emailNaoInformado = Boolean(meta.emailNaoInformado);
    return {
      id: item.id,
      assinanteNome: item.assinanteNome,
      assinanteDocumento: opts.fullPii
        ? cpfNaoInformado
          ? 'não informado'
          : item.assinanteDocumento ?? 'não informado'
        : displayAssinanteCpf({
            cpf: item.assinanteDocumento,
            cpfNaoInformado,
          }),
      assinanteEmail: opts.fullPii
        ? emailNaoInformado
          ? 'não informado'
          : item.assinanteEmail ?? 'não informado'
        : displayAssinanteEmail({
            email: item.assinanteEmail,
            emailNaoInformado,
          }),
      qualificacao: item.qualificacao,
      qualificacaoOutro: item.qualificacaoOutro,
      canal: item.canal,
      coletadaEm: item.coletadaEm?.toISOString?.() ?? item.coletadaEm,
      invalida: Boolean(item.invalida),
      invalidadaEm: item.invalidadaEm?.toISOString?.() ?? item.invalidadaEm ?? null,
      invalidadaMotivo: item.invalidadaMotivo ?? null,
      invalidadaPorId:
        typeof meta.invalidadaPorId === 'string' ? meta.invalidadaPorId : null,
      invalidadaPorNome:
        typeof meta.invalidadaPorNome === 'string' ? meta.invalidadaPorNome : null,
      cpfNaoInformado,
      emailNaoInformado,
      justificativaIdentificacao:
        typeof meta.justificativaIdentificacao === 'string'
          ? meta.justificativaIdentificacao
          : null,
      assinanteUsuario: item.assinanteUsuario ?? null,
      coletadaPor: item.coletadaPor ?? null,
      evidenciaUrl: item.evidenciaUrl ?? null,
    };
  }

  private serialize(documento: DocumentoLoaded | any, opts?: { fullPii?: boolean; usuarioId?: string }) {
    // Telas internas autenticadas: CPF/e-mail completos. Validação pública usa map próprio mascarado.
    const fullPii = opts?.fullPii !== false;
    const codigoVerificador = generateCodigoVerificador(
      documento.codigo,
      documento.codigoValidacao,
    );
    const evidenciasPorItem = this.readEvidenciasPorItem(documento.metadata);
    const meta = this.asRecord(documento.metadata);
    const origemPdf = typeof meta.origemPdf === 'string' ? meta.origemPdf : null;
    const pdfOriginalCanonico =
      !documento.pdfOriginalStorageKey
        ? false
        : documento.origem === DocumentoOrigem.CHAMADO_EXECUCAO
          ? origemPdf === 'relatorio_execucao'
          : documento.origem === DocumentoOrigem.VISTORIA
            ? origemPdf === 'relatorio_vistoria' || origemPdf == null
            : true;

    return {
      id: documento.id,
      codigo: documento.codigo,
      codigoValidacao: documento.codigoValidacao,
      codigoVerificador,
      tipo: documento.tipo,
      situacao: documento.situacao,
      origem: documento.origem,
      origemPdf,
      pdfOriginalCanonico,
      titulo: documento.titulo,
      descricao: documento.descricao,
      secretaria: documento.secretaria ?? null,
      unidade: documento.unidade ?? null,
      chamado: this.chamadoPrincipal(documento),
      chamados: this.chamadosDoDocumento(documento),
      fiscalizacao: documento.fiscalizacao
        ? {
            id: documento.fiscalizacao.id,
            status: documento.fiscalizacao.status,
            concluidaEm:
              documento.fiscalizacao.concluidaEm?.toISOString?.() ??
              documento.fiscalizacao.concluidaEm ??
              null,
            unidadeNome: documento.fiscalizacao.unidade?.nome ?? null,
            unidadeCodigo: documento.fiscalizacao.unidade?.codigoPatrimonial ?? null,
          }
        : null,
      checklist: documento.checklistVersao
        ? {
            versaoId: documento.checklistVersao.id,
            versao: documento.checklistVersao.versao,
            nome: documento.checklistVersao.checklist?.nome ?? null,
          }
        : null,
      checklistVersaoId: documento.checklistVersaoId ?? null,
      enderecoTexto: documento.enderecoTexto,
      latitude: documento.latitude != null ? Number(documento.latitude) : null,
      longitude: documento.longitude != null ? Number(documento.longitude) : null,
      responsavel: documento.responsavel ?? null,
      criadoPor: documento.criadoPor ?? null,
      conteudoTravado: Boolean(documento.conteudoTravadoEm),
      conteudoTravadoEm: documento.conteudoTravadoEm?.toISOString?.() ?? documento.conteudoTravadoEm ?? null,
      possuiPdfOriginal: Boolean(documento.pdfOriginalStorageKey),
      possuiPdfAssinado: Boolean(documento.pdfAssinadoStorageKey),
      pdfOriginalSha256: this.truncateHash(documento.pdfOriginalSha256),
      pdfAssinadoSha256: this.truncateHash(documento.pdfAssinadoSha256),
      respostas: (documento.respostas ?? []).map((item: any) => ({
        id: item.id,
        itemId: item.itemId,
        conformidade: item.conformidade,
        valorTexto: item.valorTexto,
        valorNumero: item.valorNumero != null ? Number(item.valorNumero) : null,
        valorBooleano: item.valorBooleano,
        comentario: item.comentario,
        respondidoEm: item.respondidoEm?.toISOString?.() ?? item.respondidoEm,
        evidencias: evidenciasPorItem[item.itemId] ?? [],
        item: item.item
          ? {
              id: item.item.id,
              codigo: item.item.codigo,
              secao: item.item.secao,
              titulo: item.item.titulo,
              tipo: item.item.tipo,
              ordem: item.item.ordem,
              obrigatorio: item.item.obrigatorio,
              exigeEvidencia: item.item.exigeEvidencia,
            }
          : null,
      })),
      // Somente assinaturas válidas do PDF assinado vigente.
      // Interno (fullPii): CPF/e-mail completos; listagens usam máscara por padrão.
      assinaturas: (documento.assinaturas ?? [])
        .filter((item: any) => !item.invalida)
        .map((item: any) => this.mapAssinaturaApi(item, { fullPii })),
      signatariosPendentes: (documento.assinaturaPedidos ?? []).map((pedido: any) => ({
        id: pedido.id,
        nome: pedido.destinatario?.nome ?? 'Usuário',
        email: pedido.destinatario?.email ?? null,
        requestedAt: pedido.requestedAt?.toISOString?.() ?? pedido.requestedAt,
        solicitanteNome: pedido.solicitante?.nome ?? null,
        meu: opts?.usuarioId ? pedido.destinatario?.id === opts.usuarioId : false,
      })),
      createdAt: documento.createdAt?.toISOString?.() ?? documento.createdAt,
      updatedAt: documento.updatedAt?.toISOString?.() ?? documento.updatedAt,
      linkValidacao: buildPublicValidationUrl(documento.codigoValidacao, codigoVerificador),
    };
  }
}

function mesmosIds(a: string[], b: string[]) {
  if (a.length !== b.length) return false;
  const right = new Set(b);
  return a.every((item) => right.has(item));
}

function codigosChamadosPublicos(documento: {
  chamado?: { codigo: string; excluidoEm?: Date | null } | null;
  chamadosVinculados?: Array<{ chamado: { codigo: string; excluidoEm?: Date | null } | null }>;
}) {
  const codigos: string[] = [];
  for (const vinculo of documento.chamadosVinculados ?? []) {
    if (!vinculo.chamado || vinculo.chamado.excluidoEm) continue;
    if (!codigos.includes(vinculo.chamado.codigo)) codigos.push(vinculo.chamado.codigo);
  }
  if (!codigos.length && documento.chamado && !documento.chamado.excluidoEm) codigos.push(documento.chamado.codigo);
  return codigos.length ? codigos.join(', ') : null;
}

function ordenarPendencias<T extends { atrasado: boolean; prazo: string | null; createdAt: string }>(a: T, b: T) {
  if (a.atrasado !== b.atrasado) return a.atrasado ? -1 : 1;
  if (a.prazo && b.prazo && a.prazo !== b.prazo) return a.prazo < b.prazo ? -1 : 1;
  if (a.prazo && !b.prazo) return -1;
  if (!a.prazo && b.prazo) return 1;
  return a.createdAt < b.createdAt ? 1 : -1;
}

function chamadoAtrasado(status: string, prazoEm: Date | null) {
  if (!prazoEm || status === 'CONCLUIDO' || status === 'CANCELADO') return false;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const prazo = new Date(prazoEm);
  prazo.setHours(0, 0, 0, 0);
  return prazo.getTime() < hoje.getTime();
}
