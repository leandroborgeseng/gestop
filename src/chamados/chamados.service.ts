import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  AuditAction,
  ChamadoOrigem,
  ChamadoStatus,
  OrdemServicoOrigem,
  OrdemServicoStatus,
} from '@prisma/client';
import { JwtPayload } from '../auth/jwt';
import { IntegracoesService } from '../integracoes/integracoes.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateChamadoDto, PublicCreateChamadoDto, UpdateChamadoStatusDto } from './chamados.dto';
import { buildChamadoCode } from './chamados.rules';

@Injectable()
export class ChamadosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly integracoesService: IntegracoesService,
  ) {}

  listChamados() {
    return this.prisma.chamado.findMany({
      orderBy: { createdAt: 'desc' },
      include: this.includeRelations(),
    });
  }

  getChamado(id: string) {
    return this.getChamadoOrThrow(id);
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
    const chamado = await this.prisma.chamado.update({
      where: { id },
      data: {
        status: dto.status,
        encerradoEm:
          dto.status === ChamadoStatus.ENCERRADO || dto.status === ChamadoStatus.CANCELADO
            ? new Date()
            : before.encerradoEm,
      },
      include: this.includeRelations(),
    });

    await this.prisma.historicoStatus.create({
      data: {
        entidadeTipo: 'Chamado',
        entidadeId: id,
        statusAnterior: before.status,
        statusNovo: dto.status,
        motivo: dto.motivo ?? 'Atualizacao de status do chamado.',
        alteradoPorId: user.sub,
      },
    });

    await this.audit(user.sub, AuditAction.STATUS_CHANGE, id, before, chamado);
    return chamado;
  }

  async convertToOrdemServico(id: string, user: JwtPayload) {
    const chamado = await this.getChamadoOrThrow(id);
    if (chamado.ordemServicoId) {
      throw new BadRequestException('Chamado ja possui ordem de servico vinculada.');
    }
    if (chamado.status === ChamadoStatus.CANCELADO || chamado.status === ChamadoStatus.ENCERRADO) {
      throw new BadRequestException('Chamado encerrado nao pode gerar OS.');
    }

    const osSequence = (await this.prisma.ordemServico.count()) + 1;
    const osCodigo = `OS-${new Date().getFullYear()}-${String(osSequence).padStart(6, '0')}`;

    const result = await this.prisma.$transaction(async (tx) => {
      const ordem = await tx.ordemServico.create({
        data: {
          codigo: osCodigo,
          secretariaId: chamado.secretariaId,
          unidadeId: chamado.unidadeId,
          solicitanteId: user.sub,
          origem: OrdemServicoOrigem.CHAMADO,
          titulo: `Chamado ${chamado.codigo}`,
          descricao: chamado.descricao,
          prioridade: chamado.prioridade,
          status: OrdemServicoStatus.ABERTA,
        },
      });

      const updatedChamado = await tx.chamado.update({
        where: { id },
        data: {
          ordemServicoId: ordem.id,
          status: ChamadoStatus.ENCAMINHADO_OS,
        },
        include: this.includeRelations(),
      });

      await tx.historicoStatus.createMany({
        data: [
          {
            entidadeTipo: 'OrdemServico',
            entidadeId: ordem.id,
            statusNovo: OrdemServicoStatus.ABERTA,
            motivo: `OS gerada a partir do chamado ${chamado.codigo}.`,
            alteradoPorId: user.sub,
          },
          {
            entidadeTipo: 'Chamado',
            entidadeId: id,
            statusAnterior: chamado.status,
            statusNovo: ChamadoStatus.ENCAMINHADO_OS,
            motivo: `Convertido para ${ordem.codigo}.`,
            alteradoPorId: user.sub,
          },
        ],
      });

      return { chamado: updatedChamado, ordemServico: ordem };
    });

    await this.integracoesService.notify(
      'chamado.convertido-os',
      { chamadoId: id, ordemServicoId: result.ordemServico.id },
      user,
    );

    return result;
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
      ordemServico: { select: { id: true, codigo: true, status: true } },
      registradoPor: { select: { id: true, nome: true } },
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
