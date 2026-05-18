import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  AuditAction,
  NaoConformidadeStatus,
  OrdemServicoOrigem,
  OrdemServicoStatus,
  Prisma,
} from '@prisma/client';
import { JwtPayload } from '../auth/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateOrdemServicoDto } from './ordens-servico.dto';
import {
  assertValidOrderTransition,
  buildServiceOrderCode,
  buildServiceOrderTitle,
  priorityFromSeverity,
  shouldGenerateServiceOrder,
} from './ordens-servico.rules';

type Tx = Prisma.TransactionClient;

@Injectable()
export class OrdensServicoService {
  constructor(private readonly prisma: PrismaService) {}

  listOrdens() {
    return this.prisma.ordemServico.findMany({
      orderBy: { abertaEm: 'desc' },
      include: this.includeRelations(),
    });
  }

  async getOrdem(id: string) {
    const ordem = await this.prisma.ordemServico.findUnique({
      where: { id },
      include: {
        ...this.includeRelations(),
        evidencias: true,
      },
    });

    if (!ordem) throw new NotFoundException('Ordem de serviço não encontrada');

    const historico = await this.prisma.historicoStatus.findMany({
      where: { entidadeTipo: 'OrdemServico', entidadeId: id },
      orderBy: { createdAt: 'asc' },
      include: { alteradoPor: { select: { id: true, nome: true } } },
    });

    return { ...ordem, historico };
  }

  async updateOrdem(id: string, dto: UpdateOrdemServicoDto, user: JwtPayload) {
    const before = await this.prisma.ordemServico.findUnique({ where: { id } });
    if (!before) throw new NotFoundException('Ordem de serviço não encontrada');

    try {
      assertValidOrderTransition(before.status, dto.status);
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : 'Transição inválida');
    }

    const ordem = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.ordemServico.update({
        where: { id },
        data: {
          status: dto.status,
          responsavelId: dto.responsavelId || before.responsavelId,
          impedimentoMotivo: dto.impedimentoMotivo ?? before.impedimentoMotivo,
          concluidaEm: dto.status === OrdemServicoStatus.CONCLUIDA ? new Date() : before.concluidaEm,
        },
        include: this.includeRelations(),
      });

      await tx.historicoStatus.create({
        data: {
          entidadeTipo: 'OrdemServico',
          entidadeId: id,
          statusAnterior: before.status,
          statusNovo: dto.status,
          motivo: dto.motivo ?? 'Atualização operacional da OS.',
          alteradoPorId: user.sub,
          metadata: {
            responsavelId: dto.responsavelId ?? before.responsavelId,
            impedimentoMotivo: dto.impedimentoMotivo,
          },
        },
      });

      await tx.logAuditoria.create({
        data: {
          usuarioId: user.sub,
          acao: AuditAction.STATUS_CHANGE,
          entidadeTipo: 'OrdemServico',
          entidadeId: id,
          valorAntigo: JSON.parse(JSON.stringify(before)) as Prisma.InputJsonValue,
          valorNovo: JSON.parse(JSON.stringify(updated)) as Prisma.InputJsonValue,
        },
      });

      return updated;
    });

    return ordem;
  }

  async generateForNaoConformidade(naoConformidadeId: string, user: JwtPayload) {
    return this.prisma.$transaction((tx) => this.generateForNaoConformidadeTx(tx, naoConformidadeId, user.sub));
  }

  async generateForNaoConformidadeTx(tx: Tx, naoConformidadeId: string, usuarioId: string) {
    const naoConformidade = await tx.naoConformidade.findUnique({
      where: { id: naoConformidadeId },
      include: {
        ordemServico: true,
        item: true,
        fiscalizacao: true,
        unidade: true,
        evidencias: true,
      },
    });

    if (!naoConformidade) {
      throw new NotFoundException('Não conformidade não encontrada');
    }

    if (!shouldGenerateServiceOrder({ naoConformidadeId, ordemServicoId: naoConformidade.ordemServico?.id })) {
      return naoConformidade.ordemServico;
    }

    const sequence = (await tx.ordemServico.count()) + 1;
    const ordem = await tx.ordemServico.create({
      data: {
        codigo: buildServiceOrderCode(sequence),
        secretariaId: naoConformidade.fiscalizacao.secretariaId,
        unidadeId: naoConformidade.unidadeId,
        naoConformidadeId: naoConformidade.id,
        solicitanteId: usuarioId,
        origem: OrdemServicoOrigem.NAO_CONFORMIDADE,
        titulo: buildServiceOrderTitle(naoConformidade.item.titulo),
        descricao: naoConformidade.descricao,
        prioridade: priorityFromSeverity(naoConformidade.severidade),
        status: OrdemServicoStatus.ABERTA,
        prazoEm: buildDefaultDeadline(naoConformidade.severidade),
      },
      include: this.includeRelations(),
    });

    await tx.naoConformidade.update({
      where: { id: naoConformidade.id },
      data: { status: NaoConformidadeStatus.OS_GERADA },
    });

    await tx.evidencia.updateMany({
      where: { naoConformidadeId: naoConformidade.id },
      data: { ordemServicoId: ordem.id },
    });

    await tx.historicoStatus.create({
      data: {
        entidadeTipo: 'OrdemServico',
        entidadeId: ordem.id,
        statusNovo: OrdemServicoStatus.ABERTA,
        motivo: 'OS criada automaticamente a partir de não conformidade.',
        alteradoPorId: usuarioId,
        metadata: {
          naoConformidadeId: naoConformidade.id,
          fiscalizacaoId: naoConformidade.fiscalizacaoId,
        },
      },
    });

    await tx.logAuditoria.create({
      data: {
        usuarioId,
        acao: AuditAction.CREATE,
        entidadeTipo: 'OrdemServico',
        entidadeId: ordem.id,
        valorNovo: JSON.parse(JSON.stringify(ordem)) as Prisma.InputJsonValue,
      },
    });

    return ordem;
  }

  private includeRelations() {
    return {
      secretaria: { select: { id: true, nome: true, sigla: true } },
      unidade: { select: { id: true, nome: true, codigoPatrimonial: true } },
      responsavel: { select: { id: true, nome: true } },
      naoConformidade: {
        select: {
          id: true,
          descricao: true,
          severidade: true,
          status: true,
          fiscalizacaoId: true,
          item: { select: { codigo: true, titulo: true } },
        },
      },
    } satisfies Prisma.OrdemServicoInclude;
  }
}

function buildDefaultDeadline(severidade: string) {
  const date = new Date();
  const days = severidade === 'CRITICA' ? 1 : severidade === 'ALTA' ? 2 : severidade === 'MEDIA' ? 5 : 10;
  date.setDate(date.getDate() + days);
  return date;
}
