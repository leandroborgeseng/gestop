import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction, ChecklistFinalidade, ChecklistVersaoStatus, Prisma } from '@prisma/client';
import { JwtPayload } from '../auth/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { ChecklistDto, ChecklistVersionDto } from './checklists.dto';
import {
  assertDraftEditable,
  assertValidChecklistVersion,
  nextChecklistVersion,
  normalizeChecklistBinding,
  normalizeChecklistItemOpcoes,
  normalizeItemCode,
  validateChecklistEscopo,
} from './checklist.rules';

const checklistInclude = {
  secretaria: { select: { id: true, nome: true, sigla: true } },
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

  listChecklists() {
    return this.prisma.checklist.findMany({
      orderBy: [{ ativo: 'desc' }, { nome: 'asc' }],
      include: checklistInclude,
    });
  }

  listTiposProprioOpcoes() {
    return this.prisma.tipoProprio.findMany({
      where: { ativo: true },
      orderBy: [{ ordem: 'asc' }, { nome: 'asc' }],
      select: { id: true, codigo: true, nome: true },
    });
  }

  async getChecklist(id: string): Promise<ChecklistWithRelations> {
    const checklist = await this.prisma.checklist.findUnique({
      where: { id },
      include: checklistInclude,
    });

    if (!checklist) {
      throw new NotFoundException('Checklist nao encontrado');
    }

    return checklist;
  }

  async createChecklist(dto: ChecklistDto, user: JwtPayload) {
    this.assertChecklistEscopo(dto);
    const binding = normalizeChecklistBinding(dto);
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
    this.assertChecklistEscopo(dto);
    const binding = normalizeChecklistBinding(dto);
    await this.ensureUnidadeAtiva(binding.unidadeId);
    await this.ensureTiposChamadoAtivos(binding.tipoChamadoIds);
    const before = await this.getChecklist(id);
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
        ativo: binding.ativo ?? true,
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

  async deactivateChecklist(id: string, user: JwtPayload) {
    const before = await this.getChecklist(id);
    const checklist = await this.prisma.checklist.update({
      where: { id },
      data: { ativo: false },
    });

    await this.audit(user, AuditAction.DELETE, 'Checklist', id, before, checklist);
    return checklist;
  }

  async createVersion(id: string, user: JwtPayload) {
    const checklist = await this.getChecklist(id);
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
    const version = await this.prisma.checklistVersao.findUnique({
      where: { id: versionId },
      include: { itens: true, checklist: { select: { finalidade: true, finalidades: true } } },
    });

    if (!version) {
      throw new NotFoundException('Versao de checklist nao encontrada');
    }

    try {
      assertDraftEditable(version.status);
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : 'Versao bloqueada');
    }

    const finalidadeChamado =
      version.checklist.finalidade === ChecklistFinalidade.CHAMADO ||
      (version.checklist.finalidades ?? []).includes(ChecklistFinalidade.CHAMADO);

    try {
      assertValidChecklistVersion(dto, { finalidadeChamado });
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : 'Itens invalidos');
    }

    const normalizedItens = dto.itens.map((item) => ({
      ...item,
      geraNaoConformidade: finalidadeChamado ? false : item.geraNaoConformidade,
      categoriaVistoriaId: finalidadeChamado ? null : item.categoriaVistoriaId?.trim() || null,
      opcoes: normalizeChecklistItemOpcoes(item.tipo, item.opcoes),
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
              codigo: normalizeItemCode(item.codigo),
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
    const version = await this.prisma.checklistVersao.findUnique({
      where: { id: versionId },
      include: { itens: true, checklist: { select: { finalidade: true, finalidades: true } } },
    });

    if (!version) {
      throw new NotFoundException('Versao de checklist nao encontrada');
    }

    if (version.status !== ChecklistVersaoStatus.RASCUNHO) {
      throw new BadRequestException('Apenas versoes em rascunho podem ser publicadas');
    }

    if (version.itens.length === 0) {
      throw new BadRequestException('Nao e possivel publicar checklist sem itens');
    }

    const finalidadeChamado =
      version.checklist.finalidade === ChecklistFinalidade.CHAMADO ||
      (version.checklist.finalidades ?? []).includes(ChecklistFinalidade.CHAMADO);

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
          })),
        },
        { finalidadeChamado },
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
