import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction, ChecklistEscopo, ChecklistFinalidade, ChecklistVersaoStatus, Prisma } from '@prisma/client';
import { JwtPayload } from '../auth/jwt';
import { PrismaService } from '../prisma/prisma.service';
import {
  AcaoStatusAtivo,
  assertRegistroEditavel,
  auditoriaStatusAtivo,
  CHECKLIST_INATIVO,
  planejarStatusAtivo,
} from '../common/inativos/registro-inativo';
import { assertChecklistAcao, assertChecklistNoEscopo } from './checklist-acesso';
import { prepararItensChecklist } from './checklist-item.rules';
import { ChecklistDto, ChecklistVersionDto } from './checklists.dto';
import {
  assertDraftEditable,
  assertValidChecklistVersion,
  nextChecklistVersion,
  isDocumentoAvulsoExclusivo,
  normalizeChecklistBinding,
  normalizeChecklistItemOpcoes,
  normalizeItemCode,
  validateChecklistEscopo,
} from './checklist.rules';

const checklistInclude = {
  secretaria: { select: { id: true, nome: true, sigla: true } },
  unidade: { select: { id: true, secretariaId: true, nome: true } },
  tiposChamado: {
    include: { tipoChamado: { select: { id: true, nome: true, ativo: true } } },
  },
  versoes: {
    orderBy: { versao: 'desc' as const },
    include: { itens: { orderBy: { ordem: 'asc' as const } } },
  },
} satisfies Prisma.ChecklistInclude;

type ChecklistWithRelations = Prisma.ChecklistGetPayload<{ include: typeof checklistInclude }>;

@Injectable()
export class ChecklistsService {
  constructor(private readonly prisma: PrismaService) {}

  listChecklists(user: JwtPayload) {
    assertChecklistAcao(user, 'visualizar');
    return this.checklistWhere(user).then((where) =>
      this.prisma.checklist.findMany({
        where,
        orderBy: [{ ativo: 'desc' }, { nome: 'asc' }],
        include: {
          ...checklistInclude,
          versoes: {
            orderBy: { versao: 'desc' as const },
            include: {
              itens: {
                orderBy: { ordem: 'asc' as const },
                select: { id: true, ordem: true, codigo: true, titulo: true, tipo: true },
              },
            },
          },
        },
      }),
    );
  }

  /** 309/C1/C6: contadores da sanfona, com o mesmo filtro de escopo da lista. */
  async resumoChecklists(user: JwtPayload) {
    assertChecklistAcao(user, 'visualizar');
    const where = await this.checklistWhere(user);
    const [ativos, inativos] = await Promise.all([
      this.prisma.checklist.count({ where: { AND: [where, { ativo: true }] } }),
      this.prisma.checklist.count({ where: { AND: [where, { ativo: false }] } }),
    ]);
    return { ativos, inativos, total: ativos + inativos };
  }

  async listSecretariasOpcoes(user: JwtPayload) {
    assertChecklistAcao(user, 'visualizar');
    return this.prisma.secretaria.findMany({
      where: user.secretariaId ? { id: user.secretariaId, ativo: true } : { ativo: true },
      orderBy: [{ sigla: 'asc' }],
      select: { id: true, nome: true, sigla: true, ativo: true },
    });
  }

  listTiposProprioOpcoes() {
    return this.prisma.tipoProprio.findMany({
      where: { ativo: true },
      orderBy: [{ ordem: 'asc' }, { nome: 'asc' }],
      select: { id: true, codigo: true, nome: true },
    });
  }

  async getChecklist(id: string, user?: JwtPayload): Promise<ChecklistWithRelations> {
    const checklist = await this.prisma.checklist.findUnique({
      where: { id },
      include: checklistInclude,
    });

    if (!checklist) {
      throw new NotFoundException('Checklist nao encontrado');
    }

    if (user) {
      assertChecklistAcao(user, 'visualizar');
      const where = await this.checklistWhere(user);
      const visivel = await this.prisma.checklist.findFirst({ where: { id, ...where }, select: { id: true } });
      if (!visivel) {
        throw new NotFoundException('Checklist nao encontrado');
      }
    }

    return checklist;
  }

  async createChecklist(dto: ChecklistDto, user: JwtPayload) {
    assertChecklistAcao(user, 'inserir');
    this.assertChecklistEscopo(dto);
    const binding = normalizeChecklistBinding(dto);
    await this.assertBindingNoEscopo(user, binding);
    await this.ensureUnidadeAtiva(binding.unidadeId);
    await this.ensureTiposChamadoAtivos(binding.tipoChamadoIds);
    const finalidade = (binding.finalidade ?? ChecklistFinalidade.VISTORIA) as ChecklistFinalidade;
    const finalidades = (binding.finalidades?.length ? binding.finalidades : [finalidade]) as ChecklistFinalidade[];
    const linkTiposChamado =
      finalidades.includes(ChecklistFinalidade.CHAMADO) && Boolean(binding.tipoChamadoIds?.length);

    const checklist = await this.prisma.checklist.create({
      data: {
        nome: binding.nome.trim(),
        descricao: binding.descricao?.trim(),
        finalidade,
        finalidades,
        escopo: binding.escopo,
        secretariaId: binding.secretariaId || null,
        unidadeId: binding.unidadeId || null,
        unidadeTipo: binding.unidadeTipo || null,
        ativo: binding.ativo ?? true,
        versoes: {
          create: {
            versao: 1,
            status: ChecklistVersaoStatus.RASCUNHO,
            estrutura: {},
          },
        },
        ...(linkTiposChamado
          ? {
              tiposChamado: {
                create: binding.tipoChamadoIds!.map((tipoChamadoId) => ({ tipoChamadoId })),
              },
            }
          : {}),
      },
      include: checklistInclude,
    });

    await this.audit(user, AuditAction.CREATE, 'Checklist', checklist.id, null, checklist);
    return checklist;
  }

  async updateChecklist(id: string, dto: ChecklistDto, user: JwtPayload) {
    assertChecklistAcao(user, 'alterar');
    await this.assertChecklistEditavel(id, user);
    this.assertChecklistEscopo(dto);
    const binding = normalizeChecklistBinding(dto);
    await this.assertBindingNoEscopo(user, binding);
    await this.ensureUnidadeAtiva(binding.unidadeId);
    await this.ensureTiposChamadoAtivos(binding.tipoChamadoIds);
    const before = await this.getChecklist(id, user);
    assertChecklistNoEscopo(user, before);
    const finalidade = (binding.finalidade ?? ChecklistFinalidade.VISTORIA) as ChecklistFinalidade;
    const finalidades = (binding.finalidades?.length ? binding.finalidades : [finalidade]) as ChecklistFinalidade[];
    const linkTiposChamado =
      finalidades.includes(ChecklistFinalidade.CHAMADO) && Boolean(binding.tipoChamadoIds?.length);

    await this.prisma.checklistTipoChamado.deleteMany({ where: { checklistId: id } });
    const checklist = await this.prisma.checklist.update({
      where: { id },
      data: {
        nome: binding.nome.trim(),
        descricao: binding.descricao?.trim() ?? null,
        finalidade,
        finalidades,
        escopo: binding.escopo,
        secretariaId: binding.secretariaId || null,
        unidadeId: binding.unidadeId || null,
        unidadeTipo: binding.unidadeTipo || null,
        // 309: o status só muda por Inativar/Reativar (com permissão e auditoria própria).
        ...(linkTiposChamado
          ? {
              tiposChamado: {
                create: binding.tipoChamadoIds!.map((tipoChamadoId) => ({ tipoChamadoId })),
              },
            }
          : {}),
      },
      include: checklistInclude,
    });

    await this.audit(user, AuditAction.UPDATE, 'Checklist', id, before, checklist);
    return checklist;
  }

  deactivateChecklist(id: string, user: JwtPayload) {
    return this.alterarStatusAtivo(id, 'INATIVAR', user);
  }

  reactivateChecklist(id: string, user: JwtPayload) {
    return this.alterarStatusAtivo(id, 'REATIVAR', user);
  }

  /**
   * 309/C2/C6: Inativar e Reativar usam a mesma permissão (excluir), respeitam a Secretaria ativa e gravam
   * auditoria STATUS_CHANGE com quem, quando, antes e depois, na mesma transação da troca. Nada é apagado.
   */
  private async alterarStatusAtivo(id: string, acao: AcaoStatusAtivo, user: JwtPayload) {
    assertChecklistAcao(user, 'excluir');
    const before = await this.getChecklist(id, user);
    assertChecklistNoEscopo(user, before);
    const ativo = planejarStatusAtivo(before.ativo, acao, CHECKLIST_INATIVO);
    const quando = new Date();
    return this.prisma.$transaction(async (tx) => {
      const trocou = await tx.checklist.updateMany({ where: { id, ativo: before.ativo }, data: { ativo } });
      if (trocou.count !== 1) planejarStatusAtivo(!before.ativo, acao, CHECKLIST_INATIVO);
      const checklist = await tx.checklist.findUniqueOrThrow({ where: { id } });
      const cronogramasVinculados = await tx.cronogramaChecagem.count({ where: { checklistId: id } });
      const resumo = (c: { ativo: boolean; nome: string; updatedAt: Date }) => ({
        id,
        nome: c.nome,
        ativo: c.ativo,
        atualizadoEm: c.updatedAt.toISOString(),
        cronogramasVinculados,
      });
      const { valorAntigo, valorNovo } = auditoriaStatusAtivo({
        acao,
        usuarioId: user.sub,
        quando,
        antes: resumo(before),
        depois: resumo(checklist),
      });
      await tx.logAuditoria.create({
        data: {
          usuarioId: user.sub,
          acao: AuditAction.STATUS_CHANGE,
          entidadeTipo: 'Checklist',
          entidadeId: id,
          valorAntigo: toJsonValue(valorAntigo),
          valorNovo: toJsonValue(valorNovo),
          tela: 'checklists',
          funcao: '_tela',
          descricao: acao === 'INATIVAR' ? 'Checklist inativado' : 'Checklist reativado',
          secretariaAtivaId: user.secretariaId ?? null,
          createdAt: quando,
        },
      });
      return checklist;
    });
  }

  /** 309/C3: checklist inativo é somente leitura no backend. */
  private async assertChecklistEditavel(id: string, user: JwtPayload) {
    const checklist = await this.getChecklist(id, user);
    assertRegistroEditavel(checklist, CHECKLIST_INATIVO);
    return checklist;
  }

  async createVersion(id: string, user: JwtPayload) {
    assertChecklistAcao(user, 'alterar');
    const checklist = await this.assertChecklistEditavel(id, user);
    assertChecklistNoEscopo(user, checklist);
    const draftExists = checklist.versoes.some((versao) => versao.status === ChecklistVersaoStatus.RASCUNHO);

    if (draftExists) {
      throw new BadRequestException('Ja existe uma versao em rascunho para este checklist');
    }

    const sourceVersion = checklist.versoes[0];
    const versionNumber = nextChecklistVersion(checklist.versoes);
    const version = await this.prisma.checklistVersao.create({
      data: {
        checklistId: id,
        versao: versionNumber,
        status: ChecklistVersaoStatus.RASCUNHO,
        estrutura: sourceVersion?.estrutura ?? {},
        itens: {
          create:
            sourceVersion?.itens.map((item) => ({
              ordem: item.ordem,
              codigo: item.codigo,
              secao: item.secao,
              titulo: item.titulo,
              descricao: item.descricao,
              tipo: item.tipo,
              obrigatorio: item.obrigatorio,
              geraNaoConformidade: item.geraNaoConformidade,
              exigeEvidencia: item.exigeEvidencia,
              categoriaVistoriaId: item.categoriaVistoriaId,
              opcoes: item.opcoes ?? Prisma.JsonNull,
              peso: item.peso,
              ativo: item.ativo,
            })) ?? [],
        },
      },
      include: { itens: { orderBy: { ordem: 'asc' } } },
    });

    await this.audit(user, AuditAction.CREATE, 'ChecklistVersao', version.id, null, version);
    return version;
  }

  async updateVersion(versionId: string, dto: ChecklistVersionDto, user: JwtPayload) {
    assertChecklistAcao(user, 'alterar');
    const version = await this.prisma.checklistVersao.findUnique({
      where: { id: versionId },
      include: { itens: true, checklist: { select: { finalidade: true, finalidades: true } } },
    });

    if (!version) {
      throw new NotFoundException('Versao de checklist nao encontrada');
    }
    await this.assertChecklistEditavel(version.checklistId, user);
    const alvo = await this.prisma.checklist.findUnique({
      where: { id: version.checklistId },
      include: { unidade: { select: { secretariaId: true } } },
    });
    if (alvo) assertChecklistNoEscopo(user, alvo);

    try {
      assertDraftEditable(version.status);
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : 'Versao bloqueada');
    }

    const finalidadeChamado =
      version.checklist.finalidade === ChecklistFinalidade.CHAMADO ||
      (version.checklist.finalidades ?? []).includes(ChecklistFinalidade.CHAMADO);
    const documentoAvulso = isDocumentoAvulsoExclusivo(version.checklist);

    const dtoPreparado: ChecklistVersionDto = { ...dto, itens: prepararItensChecklist(dto.itens) };
    try {
      assertValidChecklistVersion(dtoPreparado, { finalidadeChamado, finalidadeDocumentoAvulso: documentoAvulso });
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : 'Itens invalidos');
    }

    const semAvaliacaoVistoria = finalidadeChamado || documentoAvulso;
    const normalizedItens = dtoPreparado.itens.map((item) => ({
      ...item,
      geraNaoConformidade: semAvaliacaoVistoria ? false : item.geraNaoConformidade,
      categoriaVistoriaId: semAvaliacaoVistoria ? null : item.categoriaVistoriaId?.trim() || null,
      opcoes: normalizeChecklistItemOpcoes(item.tipo, item.opcoes, { omitirAvaliacao: documentoAvulso }),
    }));

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.checklistItem.deleteMany({ where: { checklistVersaoId: versionId } });
      await tx.checklistVersao.update({
        where: { id: versionId },
        data: {
          estrutura: dto.estrutura ?? {},
          itens: {
            create: normalizedItens.map((item) => ({
              ordem: item.ordem,
              codigo: normalizeItemCode(item.codigo ?? ''),
              secao: item.secao?.trim() || null,
              titulo: item.titulo.trim(),
              descricao: item.descricao?.trim(),
              tipo: item.tipo,
              obrigatorio: item.obrigatorio,
              geraNaoConformidade: item.geraNaoConformidade,
              exigeEvidencia: item.exigeEvidencia,
              categoriaVistoriaId: item.categoriaVistoriaId,
              opcoes: item.opcoes === undefined ? Prisma.JsonNull : (item.opcoes as Prisma.InputJsonValue),
            })),
          },
        },
      });

      return tx.checklistVersao.findUniqueOrThrow({
        where: { id: versionId },
        include: { itens: { orderBy: { ordem: 'asc' } } },
      });
    });

    await this.audit(user, AuditAction.UPDATE, 'ChecklistVersao', versionId, version, updated);
    return updated;
  }

  async publishVersion(versionId: string, user: JwtPayload) {
    assertChecklistAcao(user, 'alterar');
    const version = await this.prisma.checklistVersao.findUnique({
      where: { id: versionId },
      include: { itens: true, checklist: { select: { finalidade: true, finalidades: true } } },
    });

    if (!version) {
      throw new NotFoundException('Versao de checklist nao encontrada');
    }
    await this.assertChecklistEditavel(version.checklistId, user);
    const alvo = await this.prisma.checklist.findUnique({
      where: { id: version.checklistId },
      include: { unidade: { select: { secretariaId: true } } },
    });
    if (alvo) assertChecklistNoEscopo(user, alvo);

    if (version.status !== ChecklistVersaoStatus.RASCUNHO) {
      throw new BadRequestException('Apenas versoes em rascunho podem ser publicadas');
    }

    if (version.itens.length === 0) {
      throw new BadRequestException('Nao e possivel publicar checklist sem itens');
    }

    const finalidadeChamado =
      version.checklist.finalidade === ChecklistFinalidade.CHAMADO ||
      (version.checklist.finalidades ?? []).includes(ChecklistFinalidade.CHAMADO);
    const documentoAvulso = isDocumentoAvulsoExclusivo(version.checklist);

    try {
      assertValidChecklistVersion(
        {
          estrutura: version.estrutura,
          itens: version.itens.map((item) => ({
            ordem: item.ordem,
            codigo: item.codigo,
            titulo: item.titulo,
            descricao: item.descricao ?? undefined,
            tipo: item.tipo,
            obrigatorio: item.obrigatorio,
            geraNaoConformidade: item.geraNaoConformidade,
            exigeEvidencia: item.exigeEvidencia,
            categoriaVistoriaId: item.categoriaVistoriaId ?? '',
            opcoes: item.opcoes ?? undefined,
          })),
        },
        { finalidadeChamado, finalidadeDocumentoAvulso: documentoAvulso },
      );
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : 'Itens invalidos');
    }

    const published = await this.prisma.$transaction(async (tx) => {
      await tx.checklistVersao.updateMany({
        where: {
          checklistId: version.checklistId,
          status: ChecklistVersaoStatus.PUBLICADA,
        },
        data: { status: ChecklistVersaoStatus.ARQUIVADA },
      });

      return tx.checklistVersao.update({
        where: { id: versionId },
        data: {
          status: ChecklistVersaoStatus.PUBLICADA,
          publicadoAt: new Date(),
          publicadoPorId: user.sub,
        },
        include: { itens: { orderBy: { ordem: 'asc' } } },
      });
    });

    await this.audit(user, AuditAction.UPDATE, 'ChecklistVersao', versionId, version, published);
    return published;
  }

  private async ensureTiposChamadoAtivos(tipoChamadoIds?: string[]) {
    if (!tipoChamadoIds?.length) return;
    const found = await this.prisma.tipoChamado.findMany({
      where: { id: { in: tipoChamadoIds }, ativo: true },
      select: { id: true },
    });
    if (found.length !== tipoChamadoIds.length) {
      throw new BadRequestException('Um ou mais tipos de chamado sao invalidos ou inativos.');
    }
  }

  private async checklistWhere(user: JwtPayload): Promise<Prisma.ChecklistWhereInput> {
    if (!user.secretariaId) return {};
    const sid = user.secretariaId;
    const tipos = await this.prisma.unidadePublica.findMany({
      where: { secretariaId: sid },
      distinct: ['tipo'],
      select: { tipo: true },
    });
    const tipoCodes = tipos.map((item) => item.tipo).filter(Boolean);
    return {
      OR: [
        { secretariaId: sid },
        { unidade: { secretariaId: sid } },
        { escopo: ChecklistEscopo.GLOBAL },
        ...(tipoCodes.length
          ? [
              {
                escopo: ChecklistEscopo.UNIDADE_TIPO,
                unidadeTipo: { in: tipoCodes },
                OR: [{ secretariaId: null }, { secretariaId: sid }],
              },
            ]
          : []),
      ],
    };
  }

  private async assertBindingNoEscopo(
    user: JwtPayload,
    binding: { escopo: ChecklistEscopo; secretariaId?: string | null; unidadeId?: string | null },
  ) {
    const unidade = binding.unidadeId
      ? await this.prisma.unidadePublica.findUnique({
          where: { id: binding.unidadeId },
          select: { secretariaId: true },
        })
      : null;
    assertChecklistNoEscopo(user, {
      escopo: binding.escopo,
      secretariaId: binding.secretariaId,
      unidade,
    });
  }

  private async ensureUnidadeAtiva(unidadeId?: string | null) {
    if (!unidadeId) return;

    const unidade = await this.prisma.unidadePublica.findUnique({
      where: { id: unidadeId },
      select: { id: true, ativo: true },
    });

    if (!unidade) {
      throw new BadRequestException('Unidade informada para o checklist nao existe.');
    }

    if (!unidade.ativo) {
      throw new BadRequestException('Unidade informada para o checklist esta inativa.');
    }
  }

  private assertChecklistEscopo(dto: ChecklistDto) {
    try {
      validateChecklistEscopo(dto);
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : 'Escopo de checklist invalido');
    }
  }

  private audit(user: JwtPayload, acao: AuditAction, entidadeTipo: string, entidadeId: string, valorAntigo: unknown, valorNovo: unknown) {
    return this.prisma.logAuditoria.create({
      data: {
        usuarioId: user.sub,
        acao,
        entidadeTipo,
        entidadeId,
        valorAntigo: toJsonValue(valorAntigo),
        valorNovo: toJsonValue(valorNovo),
      },
    });
  }
}

function toJsonValue(value: unknown) {
  if (value === null) {
    return Prisma.JsonNull;
  }

  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
