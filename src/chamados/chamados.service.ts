import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  AuditAction,
  ChamadoOrigem,
  ChamadoStatus,
  NaoConformidadeStatus,
  Prisma,
} from '@prisma/client';
import { JwtPayload } from '../auth/jwt';
import { IntegracoesService } from '../integracoes/integracoes.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { CreateChamadoDto, PublicCreateChamadoDto, UpdateChamadoStatusDto } from './chamados.dto';
import {
  assertValidChamadoTransition,
  buildChamadoCode,
  buildChamadoTitleFromNc,
  buildDefaultDeadlineFromSeverity,
  priorityFromSeverity,
  shouldGenerateChamadoFromNc,
} from './chamados.rules';

type Tx = Prisma.TransactionClient;

@Injectable()
export class ChamadosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly integracoesService: IntegracoesService,
    private readonly storageService: StorageService,
  ) {}

  listChamados() {
    return this.prisma.chamado.findMany({
      orderBy: { createdAt: 'desc' },
      include: this.includeRelations(),
    });
  }

  async getChamado(id: string) {
    const chamado = await this.getChamadoOrThrow(id);
    const historico = await this.prisma.historicoStatus.findMany({
      where: { entidadeTipo: 'Chamado', entidadeId: id },
      orderBy: { createdAt: 'asc' },
      include: { alteradoPor: { select: { id: true, nome: true } } },
    });
    return { ...chamado, historico };
  }

  async getUnidadePublicaByCodigo(codigoPatrimonial: string) {
    const unidade = await this.prisma.unidadePublica.findFirst({
      where: {
        codigoPatrimonial: codigoPatrimonial.trim().toUpperCase(),
        ativo: true,
      },
      select: {
        id: true,
        nome: true,
        codigoPatrimonial: true,
        tipo: true,
        endereco: true,
        bairro: true,
        latitude: true,
        longitude: true,
        secretaria: { select: { id: true, nome: true, sigla: true } },
      },
    });

    if (!unidade) throw new NotFoundException('Proprio publico nao encontrado para este QR Code.');
    return {
      ...unidade,
      latitude: Number(unidade.latitude),
      longitude: Number(unidade.longitude),
    };
  }

  async createChamado(dto: CreateChamadoDto, user: JwtPayload) {
    const unidade = await this.getActiveUnidadeOrThrow(dto.unidadeId);
    const sequence = (await this.prisma.chamado.count()) + 1;

    const chamado = await this.prisma.chamado.create({
      data: {
        codigo: buildChamadoCode(sequence),
        secretariaId: unidade.secretariaId,
        unidadeId: unidade.id,
        descricao: dto.descricao.trim(),
        prioridade: dto.prioridade,
        origem: dto.origem ?? ChamadoOrigem.INTERNO,
        solicitanteNome: dto.solicitanteNome?.trim(),
        solicitanteEmail: dto.solicitanteEmail?.trim().toLowerCase(),
        solicitanteTelefone: dto.solicitanteTelefone?.trim(),
        latitude: unidade.latitude,
        longitude: unidade.longitude,
        registradoPorId: user.sub,
      },
      include: this.includeRelations(),
    });

    await this.audit(user.sub, AuditAction.CREATE, chamado.id, null, chamado);
    await this.integracoesService.notify('chamado.criado', { chamadoId: chamado.id, codigo: chamado.codigo }, user);

    return chamado;
  }

  async createChamadoPublico(codigoPatrimonial: string, dto: PublicCreateChamadoDto) {
    const unidade = await this.prisma.unidadePublica.findFirst({
      where: { codigoPatrimonial: codigoPatrimonial.trim().toUpperCase(), ativo: true },
    });
    if (!unidade) throw new NotFoundException('QR Code invalido ou proprio inativo.');

    let fotoUrl: string | undefined;
    let fotoMimeType: string | undefined;
    if (dto.fotoDataUrl?.trim()) {
      const stored = await this.storageService.persistEvidenceUrl(dto.fotoDataUrl.trim());
      fotoUrl = stored.url;
      fotoMimeType = stored.mimeType;
    }

    const sequence = (await this.prisma.chamado.count()) + 1;
    const chamado = await this.prisma.chamado.create({
      data: {
        codigo: buildChamadoCode(sequence),
        secretariaId: unidade.secretariaId,
        unidadeId: unidade.id,
        descricao: dto.descricao.trim(),
        origem: ChamadoOrigem.QR_CODE,
        solicitanteNome: dto.solicitanteNome?.trim(),
        solicitanteEmail: dto.solicitanteEmail?.trim().toLowerCase(),
        solicitanteTelefone: dto.solicitanteTelefone?.trim(),
        latitude: unidade.latitude,
        longitude: unidade.longitude,
        fotoUrl,
        fotoMimeType,
      },
      include: this.includeRelations(),
    });

    await this.prisma.logAuditoria.create({
      data: {
        acao: AuditAction.CREATE,
        entidadeTipo: 'Chamado',
        entidadeId: chamado.id,
        valorNovo: { origem: 'QR_CODE', codigo: chamado.codigo },
      },
    });

    await this.integracoesService.notifySystem('chamado.qr.criado', {
      chamadoId: chamado.id,
      codigo: chamado.codigo,
      unidadeId: unidade.id,
      secretariaId: unidade.secretariaId,
    });

    return chamado;
  }

  async updateStatus(id: string, dto: UpdateChamadoStatusDto, user: JwtPayload) {
    const before = await this.getChamadoOrThrow(id);

    try {
      assertValidChamadoTransition(before.status, dto.status);
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : 'Transição inválida');
    }

    const chamado = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.chamado.update({
        where: { id },
        data: {
          status: dto.status,
          responsavelId: dto.responsavelId ?? before.responsavelId,
          impedimentoMotivo: dto.impedimentoMotivo ?? before.impedimentoMotivo,
          concluidoEm: dto.status === ChamadoStatus.CONCLUIDO ? new Date() : before.concluidoEm,
          encerradoEm:
            dto.status === ChamadoStatus.CONCLUIDO || dto.status === ChamadoStatus.CANCELADO
              ? new Date()
              : before.encerradoEm,
        },
        include: this.includeRelations(),
      });

      await tx.historicoStatus.create({
        data: {
          entidadeTipo: 'Chamado',
          entidadeId: id,
          statusAnterior: before.status,
          statusNovo: dto.status,
          motivo: dto.motivo ?? 'Atualização de status do chamado.',
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
          entidadeTipo: 'Chamado',
          entidadeId: id,
          valorAntigo: JSON.parse(JSON.stringify(before)) as Prisma.InputJsonValue,
          valorNovo: JSON.parse(JSON.stringify(updated)) as Prisma.InputJsonValue,
        },
      });

      return updated;
    });

    return chamado;
  }

  async generateForNaoConformidade(naoConformidadeId: string, user: JwtPayload) {
    return this.prisma.$transaction((tx) => this.generateForNaoConformidadeTx(tx, naoConformidadeId, user.sub));
  }

  async generateForNaoConformidadeTx(tx: Tx, naoConformidadeId: string, usuarioId: string) {
    const naoConformidade = await tx.naoConformidade.findUnique({
      where: { id: naoConformidadeId },
      include: {
        chamado: true,
        item: true,
        fiscalizacao: true,
        unidade: true,
        evidencias: true,
      },
    });

    if (!naoConformidade) {
      throw new NotFoundException('Não conformidade não encontrada');
    }

    if (!shouldGenerateChamadoFromNc({ naoConformidadeId, chamadoId: naoConformidade.chamado?.id })) {
      return naoConformidade.chamado;
    }

    const sequence = (await tx.chamado.count()) + 1;
    const chamado = await tx.chamado.create({
      data: {
        codigo: buildChamadoCode(sequence),
        secretariaId: naoConformidade.fiscalizacao.secretariaId,
        unidadeId: naoConformidade.unidadeId,
        naoConformidadeId: naoConformidade.id,
        titulo: buildChamadoTitleFromNc(naoConformidade.item.titulo),
        descricao: naoConformidade.descricao,
        origem: ChamadoOrigem.FISCALIZACAO,
        prioridade: priorityFromSeverity(naoConformidade.severidade),
        status: ChamadoStatus.ABERTO,
        prazoEm: buildDefaultDeadlineFromSeverity(naoConformidade.severidade),
        registradoPorId: usuarioId,
      },
      include: this.includeRelations(),
    });

    await tx.naoConformidade.update({
      where: { id: naoConformidade.id },
      data: { status: NaoConformidadeStatus.CHAMADO_GERADO },
    });

    await tx.evidencia.updateMany({
      where: { naoConformidadeId: naoConformidade.id },
      data: { chamadoId: chamado.id },
    });

    await tx.historicoStatus.create({
      data: {
        entidadeTipo: 'Chamado',
        entidadeId: chamado.id,
        statusNovo: ChamadoStatus.ABERTO,
        motivo: 'Chamado criado automaticamente a partir de não conformidade.',
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
        entidadeTipo: 'Chamado',
        entidadeId: chamado.id,
        valorNovo: JSON.parse(JSON.stringify(chamado)) as Prisma.InputJsonValue,
      },
    });

    return chamado;
  }

  private async getActiveUnidadeOrThrow(unidadeId: string) {
    const unidade = await this.prisma.unidadePublica.findFirst({
      where: { id: unidadeId, ativo: true },
    });
    if (!unidade) throw new NotFoundException('Unidade nao encontrada.');
    return unidade;
  }

  private async getChamadoOrThrow(id: string) {
    const chamado = await this.prisma.chamado.findUnique({
      where: { id },
      include: this.includeRelations(),
    });
    if (!chamado) throw new NotFoundException('Chamado nao encontrado.');
    return chamado;
  }

  private includeRelations() {
    return {
      secretaria: { select: { id: true, nome: true, sigla: true } },
      unidade: { select: { id: true, nome: true, codigoPatrimonial: true, endereco: true, bairro: true } },
      responsavel: { select: { id: true, nome: true } },
      registradoPor: { select: { id: true, nome: true } },
      naoConformidade: {
        select: {
          id: true,
          descricao: true,
          severidade: true,
          status: true,
          item: { select: { codigo: true, titulo: true } },
        },
      },
    };
  }

  private audit(usuarioId: string, acao: AuditAction, entidadeId: string, antes: unknown, depois: unknown) {
    return this.prisma.logAuditoria.create({
      data: {
        usuarioId,
        acao,
        entidadeTipo: 'Chamado',
        entidadeId,
        valorAntigo: antes ? JSON.parse(JSON.stringify(antes)) : undefined,
        valorNovo: JSON.parse(JSON.stringify(depois)),
      },
    });
  }
}
