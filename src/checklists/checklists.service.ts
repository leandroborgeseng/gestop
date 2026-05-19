import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction, ChecklistVersaoStatus, Prisma } from '@prisma/client';
import { JwtPayload } from '../auth/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { ChecklistDto, ChecklistVersionDto } from './checklists.dto';
import { assertDraftEditable, nextChecklistVersion, normalizeItemCode } from './checklist.rules';

@Injectable()
export class ChecklistsService {
  constructor(private readonly prisma: PrismaService) {}

  listChecklists() {
    return this.prisma.checklist.findMany({
      orderBy: [{ ativo: 'desc' }, { nome: 'asc' }],
      include: {
        secretaria: { select: { id: true, nome: true, sigla: true } },
        versoes: {
          orderBy: { versao: 'desc' },
          include: { itens: { orderBy: { ordem: 'asc' } } },
        },
      },
    });
  }

  async getChecklist(id: string) {
    const checklist = await this.prisma.checklist.findUnique({
      where: { id },
      include: {
        secretaria: { select: { id: true, nome: true, sigla: true } },
        versoes: {
          orderBy: { versao: 'desc' },
          include: { itens: { orderBy: { ordem: 'asc' } } },
        },
      },
    });

    if (!checklist) {
      throw new NotFoundException('Checklist nao encontrado');
    }

    return checklist;
  }

  async createChecklist(dto: ChecklistDto, user: JwtPayload) {
    const checklist = await this.prisma.checklist.create({
      data: {
        nome: dto.nome.trim(),
        descricao: dto.descricao?.trim(),
        escopo: dto.escopo,
        secretariaId: dto.secretariaId || null,
        unidadeId: dto.unidadeId || null,
        unidadeTipo: dto.unidadeTipo || null,
        ativo: dto.ativo ?? true,
        versoes: {
          create: {
            versao: 1,
            status: ChecklistVersaoStatus.RASCUNHO,
            estrutura: {},
          },
        },
      },
      include: { versoes: true },
    });

    await this.audit(user, AuditAction.CREATE, 'Checklist', checklist.id, null, checklist);
    return checklist;
  }

  async updateChecklist(id: string, dto: ChecklistDto, user: JwtPayload) {
    const before = await this.getChecklist(id);
    const checklist = await this.prisma.checklist.update({
      where: { id },
      data: {
        nome: dto.nome.trim(),
        descricao: dto.descricao?.trim() ?? null,
        escopo: dto.escopo,
        secretariaId: dto.secretariaId || null,
        unidadeId: dto.unidadeId || null,
        unidadeTipo: dto.unidadeTipo || null,
        ativo: dto.ativo ?? true,
      },
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
      include: { itens: true },
    });

    if (!version) {
      throw new NotFoundException('Versao de checklist nao encontrada');
    }

    try {
      assertDraftEditable(version.status);
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : 'Versao bloqueada');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.checklistItem.deleteMany({ where: { checklistVersaoId: versionId } });
      await tx.checklistVersao.update({
        where: { id: versionId },
        data: {
          estrutura: dto.estrutura ?? {},
          itens: {
            create: dto.itens.map((item) => ({
              ordem: item.ordem,
              codigo: normalizeItemCode(item.codigo),
              titulo: item.titulo.trim(),
              descricao: item.descricao?.trim(),
              tipo: item.tipo,
              obrigatorio: item.obrigatorio,
              geraNaoConformidade: item.geraNaoConformidade,
              exigeEvidencia: item.exigeEvidencia,
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
      include: { itens: true },
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
