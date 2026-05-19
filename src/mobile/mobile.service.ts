import { BadRequestException, Injectable } from '@nestjs/common';
import {
  AuditAction,
  ConformidadeStatus,
  EntidadeSincronizavel,
  EvidenciaTipo,
  FiscalizacaoOrigem,
  FiscalizacaoStatus,
  NaoConformidadeStatus,
  OfflineOperacao,
  OfflineSyncStatus,
  Prisma,
  Severidade,
} from '@prisma/client';
import { JwtPayload } from '../auth/jwt';
import { OrdensServicoService } from '../ordens-servico/ordens-servico.service';
import { PrismaService } from '../prisma/prisma.service';
import { MobileSyncFiscalizacaoDto } from './mobile.dto';
import { validateMobileCheckin, validateMobileResponse } from './mobile.rules';

@Injectable()
export class MobileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ordensServicoService: OrdensServicoService,
  ) {}

  async getFieldPackage() {
    const [unidades, checklists] = await Promise.all([
      this.prisma.unidadePublica.findMany({
        where: { ativo: true },
        orderBy: { nome: 'asc' },
        select: {
          id: true,
          nome: true,
          codigoPatrimonial: true,
          tipo: true,
          endereco: true,
          bairro: true,
          latitude: true,
          longitude: true,
          raioValidacaoMetros: true,
          secretaria: { select: { id: true, nome: true, sigla: true } },
        },
      }),
      this.prisma.checklist.findMany({
        where: {
          ativo: true,
          versoes: { some: { status: 'PUBLICADA' } },
        },
        orderBy: { nome: 'asc' },
        include: {
          versoes: {
            where: { status: 'PUBLICADA' },
            orderBy: { versao: 'desc' },
            take: 1,
            include: { itens: { where: { ativo: true }, orderBy: { ordem: 'asc' } } },
          },
        },
      }),
    ]);

    return {
      downloadedAt: new Date().toISOString(),
      unidades: unidades.map((unidade) => ({
        ...unidade,
        latitude: Number(unidade.latitude),
        longitude: Number(unidade.longitude),
      })),
      checklists,
    };
  }

  async syncFiscalizacao(dto: MobileSyncFiscalizacaoDto, user: JwtPayload) {
    const existingEvent = await this.prisma.offlineSyncEvent.findUnique({
      where: { clientEventId: dto.clientEventId },
    });

    if (existingEvent?.status === OfflineSyncStatus.SINCRONIZADO) {
      return { status: 'duplicado', syncEventId: existingEvent.id, fiscalizacaoId: existingEvent.entidadeId };
    }

    const unidade = await this.prisma.unidadePublica.findUniqueOrThrow({
      where: { id: dto.unidadeId },
    });
    const checklistVersao = await this.prisma.checklistVersao.findUniqueOrThrow({
      where: { id: dto.checklistVersaoId },
      include: { itens: true },
    });

    const checkinValidation = validateMobileCheckin({
      unidade: {
        latitude: Number(unidade.latitude),
        longitude: Number(unidade.longitude),
        raioValidacaoMetros: unidade.raioValidacaoMetros,
      },
      checkin: dto.checkin,
    });

    if (!checkinValidation.valid) {
      await this.createSyncFailure(dto, user, checkinValidation.reasons.join('; '));
      throw new BadRequestException(checkinValidation.reasons.join('; '));
    }

    const itemById = new Map(checklistVersao.itens.map((item) => [item.id, item]));
    for (const resposta of dto.respostas) {
      const item = itemById.get(resposta.itemId);
      if (!item) throw new BadRequestException('Item de checklist invalido');

      const validation = validateMobileResponse({
        conformidade: resposta.conformidade,
        itemExigeEvidencia: item.exigeEvidencia,
        evidenciasCount: resposta.evidencias.length,
        comentario: resposta.comentario,
      });

      if (!validation.valid) {
        await this.createSyncFailure(dto, user, validation.reasons.join('; '));
        throw new BadRequestException(validation.reasons.join('; '));
      }
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const fiscalizacao = await tx.fiscalizacao.create({
        data: {
          clientId: dto.clientEventId,
          secretariaId: unidade.secretariaId,
          unidadeId: unidade.id,
          checklistVersaoId: checklistVersao.id,
          agenteId: user.sub,
          status: FiscalizacaoStatus.CONCLUIDA,
          origem: FiscalizacaoOrigem.OFFLINE,
          iniciadaEm: new Date(dto.iniciadaEm),
          concluidaEm: new Date(dto.concluidaEm),
          checkinLatitude: dto.checkin.latitude,
          checkinLongitude: dto.checkin.longitude,
          checkinPrecisaoMetros: dto.checkin.precisaoMetros,
          distanciaCheckinMetros: checkinValidation.result.distanceMeters,
          dentroRaioPermitido: true,
        },
      });

      for (const resposta of dto.respostas) {
        const item = itemById.get(resposta.itemId)!;
        const respostaCriada = await tx.respostaChecklist.create({
          data: {
            fiscalizacaoId: fiscalizacao.id,
            itemId: resposta.itemId,
            conformidade: resposta.conformidade,
            valorBooleano: resposta.valorBooleano,
            valorTexto: resposta.valorTexto,
            comentario: resposta.comentario,
          },
        });

        let naoConformidadeId: string | null = null;
        if (resposta.conformidade === ConformidadeStatus.NAO_CONFORME) {
          const naoConformidade = await tx.naoConformidade.create({
            data: {
              fiscalizacaoId: fiscalizacao.id,
              respostaId: respostaCriada.id,
              itemId: resposta.itemId,
              unidadeId: unidade.id,
              registradaPorId: user.sub,
              severidade: Severidade.MEDIA,
              status: NaoConformidadeStatus.ABERTA,
              descricao: resposta.comentario ?? item.titulo,
              latitude: dto.checkin.latitude,
              longitude: dto.checkin.longitude,
              evidenciaObrigatoriaAtendida: resposta.evidencias.length > 0,
            },
          });
          naoConformidadeId = naoConformidade.id;
        }

        for (const evidencia of resposta.evidencias) {
          await tx.evidencia.create({
            data: {
              fiscalizacaoId: fiscalizacao.id,
              respostaId: respostaCriada.id,
              naoConformidadeId,
              tipo: evidencia.tipo ?? EvidenciaTipo.FOTO,
              url: evidencia.url,
              mimeType: evidencia.mimeType,
              tamanhoBytes: evidencia.tamanhoBytes,
              latitude: evidencia.localizacao.latitude,
              longitude: evidencia.localizacao.longitude,
              precisaoMetros: evidencia.localizacao.precisaoMetros,
              capturadaEm: new Date(evidencia.capturadaEm),
              enviadaEm: new Date(),
            },
          });
        }

        if (naoConformidadeId) {
          await this.ordensServicoService.generateForNaoConformidadeTx(tx, naoConformidadeId, user.sub);
        }
      }

      const syncEvent = await tx.offlineSyncEvent.create({
        data: {
          clientEventId: dto.clientEventId,
          deviceId: dto.deviceId,
          usuarioId: user.sub,
          entidadeTipo: EntidadeSincronizavel.FISCALIZACAO,
          entidadeId: fiscalizacao.id,
          operacao: OfflineOperacao.UPSERT,
          payload: dto as unknown as Prisma.InputJsonValue,
          status: OfflineSyncStatus.SINCRONIZADO,
          ocorridoEm: new Date(dto.concluidaEm),
          sincronizadoEm: new Date(),
        },
      });

      await tx.logAuditoria.create({
        data: {
          usuarioId: user.sub,
          acao: AuditAction.SYNC,
          entidadeTipo: 'Fiscalizacao',
          entidadeId: fiscalizacao.id,
          valorNovo: dto as unknown as Prisma.InputJsonValue,
        },
      });

      return { fiscalizacao, syncEvent };
    });

    return {
      status: 'sincronizado',
      fiscalizacaoId: result.fiscalizacao.id,
      syncEventId: result.syncEvent.id,
    };
  }

  private createSyncFailure(dto: MobileSyncFiscalizacaoDto, user: JwtPayload, reason: string) {
    return this.prisma.offlineSyncEvent.upsert({
      where: { clientEventId: dto.clientEventId },
      create: {
        clientEventId: dto.clientEventId,
        deviceId: dto.deviceId,
        usuarioId: user.sub,
        entidadeTipo: EntidadeSincronizavel.FISCALIZACAO,
        operacao: OfflineOperacao.UPSERT,
        payload: dto as unknown as Prisma.InputJsonValue,
        status: OfflineSyncStatus.CONFLITO,
        conflitoMotivo: reason,
        ocorridoEm: new Date(dto.concluidaEm),
        tentativas: 1,
      },
      update: {
        status: OfflineSyncStatus.CONFLITO,
        conflitoMotivo: reason,
        tentativas: { increment: 1 },
        ultimoErro: reason,
      },
    });
  }
}
