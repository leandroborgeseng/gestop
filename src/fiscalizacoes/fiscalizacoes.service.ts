import {
  BadRequestException,
  forwardRef,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AuditAction,
  ChecklistEscopo,
  ConformidadeStatus,
  EvidenciaTipo,
  FiscalizacaoOrigem,
  FiscalizacaoStatus,
  NaoConformidadeStatus,
  Prisma,
  Severidade,
  UnidadeTipo,
} from '@prisma/client';
import { JwtPayload } from '../auth/jwt';
import {
  resolveChamadoSecretariaFilter,
  resolveDirectSecretariaFilter,
  resolveSecretariaScopeId,
  resolveSecretariaScopeIds,
  resolveUnidadeSecretariaFilter,
} from '../auth/secretaria-scope';
import { CHAMADO_OPEN_STATUSES } from '../chamados/chamados.rules';
import { ChamadosService } from '../chamados/chamados.service';
import { checklistAppliesToUnidade } from '../checklists/checklist-matching';
import { CronogramaService } from '../cronograma/cronograma.service';
import { validateChecklistResponses } from '../domain/checklist-response.rules';
import { computeVistoriaNotas } from '../domain/vistoria-nota';
import { buildFieldPackageChecklistWhere } from '../mobile/field-package';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { ListFiscalizacoesQueryDto } from './fiscalizacoes.dto';
import {
  ImprimirVistoriaManualDto,
  LancamentoManualFiscalizacaoDto,
} from './fiscalizacoes-manual.dto';
import { buildVistoriaManualPdf } from './vistoria-manual-pdf';

const UNIDADE_TIPO_LABELS: Record<UnidadeTipo, string> = {
  ESCOLA: 'Escola',
  UBS: 'UBS',
  PRACA: 'Praça',
  PREDIO_ADMINISTRATIVO: 'Prédio administrativo',
  ESPACO_ESPORTIVO: 'Espaço esportivo',
  OUTRO: 'Outro',
};

const listInclude = {
  secretaria: { select: { id: true, sigla: true, nome: true } },
  unidade: { select: { id: true, nome: true, codigoPatrimonial: true, bairro: true, tipo: true } },
  agente: { select: { id: true, nome: true } },
  checklistVersao: {
    select: {
      id: true,
      versao: true,
      checklist: { select: { id: true, nome: true } },
    },
  },
} satisfies Prisma.FiscalizacaoInclude;

const listRespostasSelect = {
  valorTexto: true,
  valorBooleano: true,
  item: {
    select: {
      tipo: true,
      opcoes: true,
      categoriaVistoriaId: true,
      categoriaVistoria: { select: { id: true, nome: true } },
    },
  },
} satisfies Prisma.RespostaChecklistSelect;

function isLancamentoManualMetadata(metadata: unknown): boolean {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return false;
  return (metadata as Record<string, unknown>).lancamentoManual === true;
}

function asMetadataRecord(metadata: unknown): Record<string, unknown> | null {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return null;
  return metadata as Record<string, unknown>;
}

@Injectable()
export class FiscalizacoesService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => ChamadosService))
    private readonly chamadosService: ChamadosService,
    private readonly storageService: StorageService,
    private readonly cronogramaService: CronogramaService,
  ) {}

  async list(query: ListFiscalizacoesQueryDto, user: JwtPayload) {
    const limit = query.limit ?? 50;
    const offset = query.offset ?? 0;
    const where = this.buildWhere(query, user);

    const [items, total] = await Promise.all([
      this.prisma.fiscalizacao.findMany({
        where,
        orderBy: [{ concluidaEm: 'desc' }, { iniciadaEm: 'desc' }, { createdAt: 'desc' }],
        take: limit,
        skip: offset,
        include: {
          ...listInclude,
          respostas: { select: listRespostasSelect },
        },
      }),
      this.prisma.fiscalizacao.count({ where }),
    ]);

    return {
      items: items.map(({ respostas, ...item }) => ({
        ...this.serialize(item),
        nota: computeVistoriaNotas(respostas),
      })),
      total,
      limit,
      offset,
      hasMore: offset + items.length < total,
    };
  }

  async getById(id: string, user: JwtPayload) {
    const fiscalizacao = await this.prisma.fiscalizacao.findFirst({
      where: {
        id,
        ...this.scopeFilter(user),
      },
      include: {
        ...listInclude,
        respostas: {
          orderBy: { respondidoEm: 'asc' },
          include: {
            item: {
              select: {
                id: true,
                codigo: true,
                titulo: true,
                tipo: true,
                opcoes: true,
                categoriaVistoriaId: true,
                categoriaVistoria: { select: { id: true, nome: true } },
              },
            },
            naoConformidade: {
              select: {
                id: true,
                status: true,
                motivoBaixa: true,
                baixadaEm: true,
                chamado: { select: { id: true, codigo: true, status: true } },
              },
            },
            evidencias: {
              orderBy: { capturadaEm: 'asc' },
              select: {
                id: true,
                tipo: true,
                url: true,
                mimeType: true,
                capturadaEm: true,
                metadata: true,
              },
            },
          },
        },
        evidencias: {
          orderBy: { capturadaEm: 'asc' },
          select: {
            id: true,
            tipo: true,
            url: true,
            mimeType: true,
            capturadaEm: true,
            metadata: true,
            respostaId: true,
          },
        },
        naoConformidades: {
          select: {
            id: true,
            descricao: true,
            severidade: true,
            status: true,
            motivoBaixa: true,
            baixadaEm: true,
            item: { select: { codigo: true, titulo: true } },
            chamado: { select: { id: true, codigo: true, status: true } },
          },
        },
      },
    });

    if (!fiscalizacao) {
      throw new NotFoundException('Vistoria não encontrada.');
    }

    const nota = computeVistoriaNotas(fiscalizacao.respostas);

    return {
      ...this.serialize(fiscalizacao),
      nota,
      respostas: fiscalizacao.respostas.map((resposta) => ({
        ...resposta,
        valorNumero: resposta.valorNumero == null ? null : Number(resposta.valorNumero),
        respondidoEm: resposta.respondidoEm.toISOString(),
        naoConformidade: resposta.naoConformidade
          ? {
              ...resposta.naoConformidade,
              baixadaEm: resposta.naoConformidade.baixadaEm?.toISOString() ?? null,
            }
          : null,
        evidencias: resposta.evidencias.map((evidencia) => ({
          ...evidencia,
          capturadaEm: evidencia.capturadaEm.toISOString(),
        })),
      })),
      evidencias: fiscalizacao.evidencias.map((evidencia) => ({
        ...evidencia,
        capturadaEm: evidencia.capturadaEm.toISOString(),
      })),
      naoConformidades: fiscalizacao.naoConformidades.map((nc) => ({
        ...nc,
        baixadaEm: nc.baixadaEm?.toISOString() ?? null,
      })),
    };
  }

  async getOpcoesManuais(user: JwtPayload) {
    const scopeIds = resolveSecretariaScopeIds(user);
    const activeSecretariaId = resolveSecretariaScopeId(user) ?? null;
    const unidadeScope = resolveUnidadeSecretariaFilter(user);
    const checklistWhere = buildFieldPackageChecklistWhere(
      activeSecretariaId,
      !activeSecretariaId && scopeIds ? scopeIds : undefined,
    );

    const [unidades, checklists] = await Promise.all([
      this.prisma.unidadePublica.findMany({
        where: { ativo: true, ...unidadeScope },
        orderBy: { nome: 'asc' },
        select: {
          id: true,
          nome: true,
          codigoPatrimonial: true,
          tipo: true,
          endereco: true,
          bairro: true,
          secretariaId: true,
          secretaria: { select: { id: true, nome: true, sigla: true } },
        },
      }),
      this.prisma.checklist.findMany({
        where: checklistWhere,
        orderBy: { nome: 'asc' },
        include: {
          secretaria: { select: { id: true, nome: true, sigla: true } },
          versoes: {
            where: { status: 'PUBLICADA' },
            orderBy: { versao: 'desc' },
            take: 1,
            include: {
              itens: {
                where: { ativo: true },
                orderBy: { ordem: 'asc' },
              },
            },
          },
        },
      }),
    ]);

    return {
      secretariaEscopo: {
        ativaId: activeSecretariaId,
        todas: scopeIds === undefined,
      },
      unidades,
      checklists: checklists.filter((checklist) => checklist.versoes.length > 0),
    };
  }

  async imprimirManual(dto: ImprimirVistoriaManualDto, user: JwtPayload) {
    const unidadeIds = Array.from(new Set(dto.unidadeIds.map((id) => id.trim()).filter(Boolean)));
    if (unidadeIds.length === 0) {
      throw new BadRequestException('Selecione ao menos um próprio.');
    }
    if (unidadeIds.length > 40) {
      throw new BadRequestException('Selecione no máximo 40 próprios por impressão.');
    }

    const ondeEncaminharFotos = dto.ondeEncaminharFotos.trim();
    if (ondeEncaminharFotos.length < 3) {
      throw new BadRequestException('Informe onde encaminhar as fotos.');
    }

    const versao = await this.prisma.checklistVersao.findUnique({
      where: { id: dto.checklistVersaoId },
      include: {
        itens: { where: { ativo: true }, orderBy: { ordem: 'asc' } },
        checklist: {
          select: {
            id: true,
            nome: true,
            escopo: true,
            secretariaId: true,
            unidadeId: true,
            unidadeTipo: true,
            ativo: true,
            finalidade: true,
          },
        },
      },
    });

    if (!versao || versao.status !== 'PUBLICADA') {
      throw new BadRequestException('Checklist/versão inválida ou não publicada.');
    }
    if (versao.checklist.finalidade === 'CHAMADO') {
      throw new BadRequestException('Este checklist é de execução de chamado e não pode ser impresso como vistoria.');
    }

    const unidades = await this.resolveUnidadesParaManual(
      {
        id: versao.checklist.id,
        escopo: versao.checklist.escopo,
        secretariaId: versao.checklist.secretariaId,
        unidadeId: versao.checklist.unidadeId,
        unidadeTipo: versao.checklist.unidadeTipo,
        ativo: versao.checklist.ativo,
      },
      unidadeIds,
      user,
    );

    if (unidades.length === 0) {
      throw new BadRequestException(
        'Nenhum próprio encontrado para os filtros informados (permissões e vínculos do checklist).',
      );
    }

    if (unidades.length !== unidadeIds.length) {
      throw new BadRequestException('Um ou mais próprios não foram encontrados no seu escopo ou não se aplicam ao checklist.');
    }

    const unidadeById = new Map(unidades.map((unidade) => [unidade.id, unidade]));
    const orderedUnidades = unidadeIds.map((id) => unidadeById.get(id)!);

    const chamadosPendentes = await this.prisma.chamado.findMany({
      where: {
        unidadeId: { in: unidadeIds },
        status: { in: CHAMADO_OPEN_STATUSES },
        ...this.chamadoScopeFilter(user),
      },
      orderBy: [{ prioridade: 'desc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        codigo: true,
        descricao: true,
        status: true,
        prioridade: true,
        createdAt: true,
        unidadeId: true,
        fotoUrl: true,
        tipoChamado: { select: { nome: true } },
        equipe: { select: { nome: true } },
        responsavel: { select: { nome: true } },
        evidencias: { select: { id: true }, take: 1 },
      },
    });

    const chamadosByUnidade = new Map<string, typeof chamadosPendentes>();
    for (const chamado of chamadosPendentes) {
      if (!chamado.unidadeId) continue;
      const list = chamadosByUnidade.get(chamado.unidadeId) ?? [];
      list.push(chamado);
      chamadosByUnidade.set(chamado.unidadeId, list);
    }

    const pdf = await buildVistoriaManualPdf({
      checklistNome: versao.checklist.nome,
      checklistVersao: versao.versao,
      ondeEncaminharFotos,
      geradoEm: new Date().toISOString(),
      geradoPor: user.nome ?? user.email ?? null,
      itens: versao.itens.map((item) => ({
        ordem: item.ordem,
        codigo: item.codigo,
        titulo: item.titulo,
        descricao: item.descricao,
        tipo: item.tipo,
        obrigatorio: item.obrigatorio,
        exigeEvidencia: item.exigeEvidencia,
        geraNaoConformidade: item.geraNaoConformidade,
        opcoes: item.opcoes,
      })),
      unidades: orderedUnidades.map((unidade) => ({
        nome: unidade.nome,
        codigoPatrimonial: unidade.codigoPatrimonial,
        tipo: UNIDADE_TIPO_LABELS[unidade.tipo] ?? unidade.tipo,
        endereco: unidade.endereco,
        bairro: unidade.bairro,
        secretariaSigla: unidade.secretaria.sigla,
        secretariaNome: unidade.secretaria.nome,
        chamadosPendentes: (chamadosByUnidade.get(unidade.id) ?? []).map((chamado) => ({
          codigo: chamado.codigo,
          tipo: chamado.tipoChamado?.nome ?? null,
          descricao: chamado.descricao,
          status: chamado.status,
          prioridade: chamado.prioridade,
          abertura: chamado.createdAt.toISOString(),
          equipe: chamado.equipe?.nome ?? null,
          responsavel: chamado.responsavel?.nome ?? null,
          temFoto: Boolean(chamado.fotoUrl) || chamado.evidencias.length > 0,
        })),
      })),
    });

    await this.prisma.logAuditoria.create({
      data: {
        usuarioId: user.sub,
        acao: AuditAction.CREATE,
        entidadeTipo: 'VistoriaManualPdf',
        entidadeId: versao.checklist.id,
        valorNovo: {
          checklistVersaoId: versao.id,
          unidadeIds,
          ondeEncaminharFotos,
          totalPaginas: orderedUnidades.length,
        } as Prisma.InputJsonValue,
      },
    });

    return pdf;
  }

  async lancamentoManual(dto: LancamentoManualFiscalizacaoDto, user: JwtPayload) {
    const dataVistoria = this.parseDataVistoria(dto.dataVistoria);
    const unidadeScope = resolveUnidadeSecretariaFilter(user);

    const unidade = await this.prisma.unidadePublica.findFirst({
      where: { id: dto.unidadeId, ativo: true, ...unidadeScope },
    });
    if (!unidade) {
      throw new NotFoundException('Próprio não encontrado ou fora do escopo.');
    }

    const checklistVersao = await this.prisma.checklistVersao.findUnique({
      where: { id: dto.checklistVersaoId },
      include: {
        itens: true,
        checklist: {
          select: {
            id: true,
            escopo: true,
            secretariaId: true,
            unidadeId: true,
            unidadeTipo: true,
            ativo: true,
            finalidade: true,
          },
        },
      },
    });

    if (!checklistVersao || checklistVersao.status !== 'PUBLICADA') {
      throw new BadRequestException('Somente versões publicadas podem ser usadas.');
    }
    if (checklistVersao.checklist.finalidade === 'CHAMADO') {
      throw new BadRequestException('Este checklist é exclusivo de execução de chamado.');
    }
    if (
      !checklistAppliesToUnidade(checklistVersao.checklist, {
        id: unidade.id,
        tipo: unidade.tipo,
        secretariaId: unidade.secretariaId,
      })
    ) {
      throw new BadRequestException('Este checklist não se aplica ao próprio selecionado.');
    }

    const itemById = new Map(checklistVersao.itens.map((item) => [item.id, item]));
    const responsesValidation = validateChecklistResponses(
      checklistVersao.itens.map((item) => ({
        id: item.id,
        titulo: item.titulo,
        tipo: item.tipo,
        obrigatorio: item.obrigatorio,
        exigeEvidencia: item.exigeEvidencia,
        opcoes: item.opcoes,
      })),
      dto.respostas.map((resposta) => ({
        itemId: resposta.itemId,
        conformidade: resposta.conformidade,
        valorTexto: resposta.valorTexto,
        comentario: resposta.comentario,
        evidenciasCount: resposta.evidencias.length,
      })),
    );

    if (!responsesValidation.valid) {
      throw new BadRequestException(responsesValidation.reasons.join('; '));
    }

    const dataLancamento = new Date();
    const respostasPreparadas = await Promise.all(
      dto.respostas.map(async (resposta) => ({
        ...resposta,
        evidenciasArmazenadas: await Promise.all(
          resposta.evidencias.map(async (evidencia) => ({
            original: evidencia,
            stored: await this.storageService.persistEvidenceUrl(evidencia.url, evidencia.mimeType),
          })),
        ),
      })),
    );

    const persistedStorageKeys = respostasPreparadas.flatMap((resposta) =>
      resposta.evidenciasArmazenadas.map((evidencia) => evidencia.stored.storageKey),
    );

    try {
      const fiscalizacao = await this.prisma.$transaction(async (tx) => {
        const created = await tx.fiscalizacao.create({
          data: {
            secretariaId: unidade.secretariaId,
            unidadeId: unidade.id,
            checklistVersaoId: checklistVersao.id,
            agenteId: user.sub,
            status: FiscalizacaoStatus.CONCLUIDA,
            origem: FiscalizacaoOrigem.MANUAL,
            iniciadaEm: dataVistoria,
            concluidaEm: dataVistoria,
            dataVistoriaInformada: dataVistoria,
            dentroRaioPermitido: null,
            distanciaCheckinMetros: null,
            observacoes: dto.observacoes?.trim() || null,
            metadata: {
              lancamentoManual: true,
              dataVistoriaInformada: dataVistoria.toISOString(),
              dataLancamento: dataLancamento.toISOString(),
              ignorouRaioGps: true,
            } as Prisma.InputJsonValue,
          },
        });

        for (const resposta of respostasPreparadas) {
          const item = itemById.get(resposta.itemId)!;
          const respostaCriada = await tx.respostaChecklist.create({
            data: {
              fiscalizacaoId: created.id,
              itemId: resposta.itemId,
              conformidade: resposta.conformidade,
              valorBooleano: resposta.valorBooleano ?? null,
              valorTexto: resposta.valorTexto,
              valorNumero: resposta.valorNumero,
              comentario: resposta.comentario,
              respondidoEm: dataVistoria,
            },
          });

          let naoConformidadeId: string | null = null;
          if (resposta.conformidade === ConformidadeStatus.NAO_CONFORME && item.geraNaoConformidade) {
            const naoConformidade = await tx.naoConformidade.create({
              data: {
                fiscalizacaoId: created.id,
                respostaId: respostaCriada.id,
                itemId: resposta.itemId,
                unidadeId: unidade.id,
                registradaPorId: user.sub,
                severidade: Severidade.MEDIA,
                status: NaoConformidadeStatus.ABERTA,
                descricao: resposta.comentario ?? item.titulo,
                evidenciaObrigatoriaAtendida: resposta.evidenciasArmazenadas.length > 0,
              },
            });
            naoConformidadeId = naoConformidade.id;
          }

          for (const evidencia of resposta.evidenciasArmazenadas) {
            await tx.evidencia.create({
              data: {
                fiscalizacaoId: created.id,
                respostaId: respostaCriada.id,
                naoConformidadeId,
                tipo: evidencia.original.tipo ?? EvidenciaTipo.FOTO,
                url: evidencia.stored.url,
                storageKey: evidencia.stored.storageKey,
                mimeType: evidencia.stored.mimeType ?? evidencia.original.mimeType,
                tamanhoBytes: evidencia.stored.tamanhoBytes || evidencia.original.tamanhoBytes,
                checksum: evidencia.stored.checksum,
                latitude: evidencia.original.localizacao?.latitude,
                longitude: evidencia.original.localizacao?.longitude,
                precisaoMetros: evidencia.original.localizacao?.precisaoMetros,
                capturadaEm: new Date(evidencia.original.capturadaEm),
                enviadaEm: dataLancamento,
              },
            });
          }

          if (naoConformidadeId && resposta.gerarChamado !== false) {
            await this.chamadosService.generateForNaoConformidadeTx(tx, naoConformidadeId, user.sub);
          }
        }

        await tx.logAuditoria.create({
          data: {
            usuarioId: user.sub,
            acao: AuditAction.CREATE,
            entidadeTipo: 'Fiscalizacao',
            entidadeId: created.id,
            valorNovo: {
              origem: FiscalizacaoOrigem.MANUAL,
              lancamentoManual: true,
              dataVistoriaInformada: dataVistoria.toISOString(),
              dataLancamento: dataLancamento.toISOString(),
              unidadeId: unidade.id,
              checklistVersaoId: checklistVersao.id,
              totalRespostas: dto.respostas.length,
            } as Prisma.InputJsonValue,
          },
        });

        return created;
      });

      await this.cronogramaService.registrarChecagemRealizada({
        unidadeId: unidade.id,
        checklistId: checklistVersao.checklist.id,
        concluidaEm: dataVistoria,
      });

      return this.getById(fiscalizacao.id, user);
    } catch (error) {
      await this.storageService.deleteStoredObjects(persistedStorageKeys);
      throw error;
    }
  }

  private async resolveUnidadesParaManual(
    checklist: {
      id: string;
      escopo: ChecklistEscopo;
      secretariaId?: string | null;
      unidadeId?: string | null;
      unidadeTipo?: UnidadeTipo | null;
      ativo?: boolean;
    },
    unidadeIds: string[],
    user: JwtPayload,
  ) {
    const unidadeScope = resolveUnidadeSecretariaFilter(user);
    const unidades = await this.prisma.unidadePublica.findMany({
      where: {
        ativo: true,
        ...unidadeScope,
        id: { in: unidadeIds },
      },
      orderBy: { nome: 'asc' },
      select: {
        id: true,
        nome: true,
        codigoPatrimonial: true,
        tipo: true,
        endereco: true,
        bairro: true,
        secretariaId: true,
        secretaria: { select: { id: true, nome: true, sigla: true } },
      },
    });

    return unidades.filter((unidade) =>
      checklistAppliesToUnidade(checklist, {
        id: unidade.id,
        tipo: unidade.tipo,
        secretariaId: unidade.secretariaId,
      }),
    );
  }

  private parseDataVistoria(value: string) {
    const trimmed = value.trim();
    const dateOnly = trimmed.slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateOnly) && (trimmed.length === 10 || trimmed.includes('T'))) {
      const parsed = trimmed.length === 10 ? new Date(`${dateOnly}T12:00:00.000Z`) : new Date(trimmed);
      if (Number.isNaN(parsed.getTime())) {
        throw new BadRequestException('Data da vistoria inválida.');
      }
      const today = new Date();
      const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
      if (parsed > tomorrow) {
        throw new BadRequestException('A data da vistoria não pode ser futura.');
      }
      return parsed;
    }
    throw new BadRequestException('Informe a data da vistoria no formato AAAA-MM-DD.');
  }

  private chamadoScopeFilter(user: JwtPayload): Prisma.ChamadoWhereInput {
    return resolveChamadoSecretariaFilter(user);
  }

  private buildWhere(query: ListFiscalizacoesQueryDto, user: JwtPayload): Prisma.FiscalizacaoWhereInput {
    const scope = this.scopeFilter(user);
    const search = query.q?.trim();

    return {
      ...scope,
      ...(query.secretariaId ? { secretariaId: query.secretariaId } : {}),
      ...(query.unidadeId ? { unidadeId: query.unidadeId } : {}),
      ...(query.agenteId ? { agenteId: query.agenteId } : {}),
      ...(query.tipo ? { unidade: { tipo: query.tipo } } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.from || query.to
        ? {
            OR: [
              {
                concluidaEm: {
                  ...(query.from ? { gte: new Date(query.from) } : {}),
                  ...(query.to ? { lte: new Date(`${query.to}T23:59:59.999Z`) } : {}),
                },
              },
              {
                AND: [
                  { concluidaEm: null },
                  {
                    iniciadaEm: {
                      ...(query.from ? { gte: new Date(query.from) } : {}),
                      ...(query.to ? { lte: new Date(`${query.to}T23:59:59.999Z`) } : {}),
                    },
                  },
                ],
              },
            ],
          }
        : {}),
      ...(search
        ? {
            OR: [
              { unidade: { nome: { contains: search, mode: 'insensitive' } } },
              { unidade: { codigoPatrimonial: { contains: search, mode: 'insensitive' } } },
              { agente: { nome: { contains: search, mode: 'insensitive' } } },
              { checklistVersao: { checklist: { nome: { contains: search, mode: 'insensitive' } } } },
            ],
          }
        : {}),
    };
  }

  private scopeFilter(user: JwtPayload): Prisma.FiscalizacaoWhereInput {
    return resolveDirectSecretariaFilter(user);
  }

  private serialize<T extends {
    origem?: FiscalizacaoOrigem | string;
    metadata?: unknown;
    dataVistoriaInformada?: Date | null;
    distanciaCheckinMetros?: unknown;
    checkinLatitude?: unknown;
    checkinLongitude?: unknown;
    checkoutLatitude?: unknown;
    checkoutLongitude?: unknown;
    iniciadaEm?: Date | null;
    concluidaEm?: Date | null;
    createdAt?: Date;
    updatedAt?: Date;
  }>(fiscalizacao: T) {
    const metadata = asMetadataRecord(fiscalizacao.metadata);
    const lancamentoManual =
      fiscalizacao.origem === FiscalizacaoOrigem.MANUAL || isLancamentoManualMetadata(fiscalizacao.metadata);
    const dataVistoriaInformada =
      fiscalizacao.dataVistoriaInformada?.toISOString() ??
      (typeof metadata?.dataVistoriaInformada === 'string'
        ? metadata.dataVistoriaInformada
        : fiscalizacao.iniciadaEm?.toISOString() ?? fiscalizacao.concluidaEm?.toISOString() ?? null);
    const dataLancamento =
      typeof metadata?.dataLancamento === 'string'
        ? metadata.dataLancamento
        : fiscalizacao.createdAt?.toISOString() ?? null;

    return {
      ...fiscalizacao,
      distanciaCheckinMetros:
        fiscalizacao.distanciaCheckinMetros == null ? null : Number(fiscalizacao.distanciaCheckinMetros),
      checkinLatitude: fiscalizacao.checkinLatitude == null ? null : Number(fiscalizacao.checkinLatitude),
      checkinLongitude: fiscalizacao.checkinLongitude == null ? null : Number(fiscalizacao.checkinLongitude),
      checkoutLatitude: fiscalizacao.checkoutLatitude == null ? null : Number(fiscalizacao.checkoutLatitude),
      checkoutLongitude: fiscalizacao.checkoutLongitude == null ? null : Number(fiscalizacao.checkoutLongitude),
      iniciadaEm: fiscalizacao.iniciadaEm?.toISOString() ?? null,
      concluidaEm: fiscalizacao.concluidaEm?.toISOString() ?? null,
      createdAt: fiscalizacao.createdAt?.toISOString(),
      updatedAt: fiscalizacao.updatedAt?.toISOString(),
      lancamentoManual,
      dataVistoriaInformada: lancamentoManual ? dataVistoriaInformada : fiscalizacao.dataVistoriaInformada?.toISOString() ?? null,
      dataLancamento: lancamentoManual ? dataLancamento : null,
      origemLabel: this.origemLabel(fiscalizacao.origem, lancamentoManual),
    };
  }

  private origemLabel(origem: FiscalizacaoOrigem | string | undefined, lancamentoManual: boolean) {
    if (lancamentoManual || origem === FiscalizacaoOrigem.MANUAL) return 'Manual';
    switch (origem) {
      case FiscalizacaoOrigem.ROTINA:
        return 'Rotina';
      case FiscalizacaoOrigem.CHAMADO:
        return 'Chamado';
      case FiscalizacaoOrigem.AVULSA:
        return 'Avulsa';
      case FiscalizacaoOrigem.OFFLINE:
        return 'Campo / offline';
      default:
        return origem ?? '—';
    }
  }
}
