import { BadRequestException, forwardRef, Inject, Injectable } from '@nestjs/common';
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
import { ChamadosService } from '../chamados/chamados.service';
import { CronogramaService } from '../cronograma/cronograma.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { MobileSyncFiscalizacaoDto } from './mobile.dto';
import { validateMobileCheckin } from './mobile.rules';
import { buildFieldPackageChecklistWhere } from './field-package';
import { validateChecklistResponses } from '../domain/checklist-response.rules';
import { checklistAppliesToUnidade } from '../checklists/checklist-matching';

@Injectable()
export class MobileService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => ChamadosService))
    private readonly chamadosService: ChamadosService,
    private readonly storageService: StorageService,
    private readonly cronogramaService: CronogramaService,
  ) {}

  async getFieldPackage(user: JwtPayload) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: user.sub },
      select: { secretariaId: true },
    });

    const unidadeWhere = {
      ativo: true,
      ...(usuario?.secretariaId ? { secretariaId: usuario.secretariaId } : {}),
    };

    const [unidades, checklists] = await Promise.all([
      this.prisma.unidadePublica.findMany({
        where: unidadeWhere,
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
        where: buildFieldPackageChecklistWhere(usuario?.secretariaId),
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

    const fiscalizacaoExistente = await this.prisma.fiscalizacao.findUnique({
      where: { clientId: dto.clientEventId },
      select: { id: true },
    });
    if (fiscalizacaoExistente) {
      return { status: 'duplicado', fiscalizacaoId: fiscalizacaoExistente.id };
    }

    const unidade = await this.prisma.unidadePublica.findUniqueOrThrow({
      where: { id: dto.unidadeId },
    });
    const checklistVersao = await this.prisma.checklistVersao.findUniqueOrThrow({
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
          },
        },
      },
    });

    if (checklistVersao.status !== 'PUBLICADA') {
      throw new BadRequestException('Somente versoes publicadas podem ser usadas em campo.');
    }

    if (
      !checklistAppliesToUnidade(checklistVersao.checklist, {
        id: unidade.id,
        tipo: unidade.tipo,
        secretariaId: unidade.secretariaId,
      })
    ) {
      throw new BadRequestException('Este checklist nao se aplica ao tipo ou secretaria do proprio selecionado.');
    }

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
      await this.createSyncFailure(dto, user, responsesValidation.reasons.join('; '));
      throw new BadRequestException(responsesValidation.reasons.join('; '));
    }

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

      for (const resposta of respostasPreparadas) {
        const item = itemById.get(resposta.itemId)!;
        const respostaCriada = await tx.respostaChecklist.create({
          data: {
            fiscalizacaoId: fiscalizacao.id,
            itemId: resposta.itemId,
            conformidade: resposta.conformidade,
            valorBooleano: resposta.valorBooleano,
            valorTexto: resposta.valorTexto,
            valorNumero: resposta.valorNumero,
            comentario: resposta.comentario,
          },
        });

        let naoConformidadeId: string | null = null;
        if (resposta.conformidade === ConformidadeStatus.NAO_CONFORME && item.geraNaoConformidade) {
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
              evidenciaObrigatoriaAtendida: resposta.evidenciasArmazenadas.length > 0,
            },
          });
          naoConformidadeId = naoConformidade.id;
        }

        for (const evidencia of resposta.evidenciasArmazenadas) {
          await tx.evidencia.create({
            data: {
              fiscalizacaoId: fiscalizacao.id,
              respostaId: respostaCriada.id,
              naoConformidadeId,
              tipo: evidencia.original.tipo ?? EvidenciaTipo.FOTO,
              url: evidencia.stored.url,
              storageKey: evidencia.stored.storageKey,
              mimeType: evidencia.stored.mimeType ?? evidencia.original.mimeType,
              tamanhoBytes: evidencia.stored.tamanhoBytes || evidencia.original.tamanhoBytes,
              checksum: evidencia.stored.checksum,
              latitude: evidencia.original.localizacao.latitude,
              longitude: evidencia.original.localizacao.longitude,
              precisaoMetros: evidencia.original.localizacao.precisaoMetros,
              capturadaEm: new Date(evidencia.original.capturadaEm),
              enviadaEm: new Date(),
            },
          });
        }

        if (naoConformidadeId) {
          await this.chamadosService.generateForNaoConformidadeTx(tx, naoConformidadeId, user.sub);
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

      await this.cronogramaService.registrarChecagemRealizada({
        unidadeId: unidade.id,
        checklistId: checklistVersao.checklist.id,
        concluidaEm: new Date(dto.concluidaEm),
      });

      return {
        status: 'sincronizado',
        fiscalizacaoId: result.fiscalizacao.id,
        syncEventId: result.syncEvent.id,
      };
    } catch (error) {
      await this.storageService.deleteStoredObjects(persistedStorageKeys);
      throw error;
    }
  }

  async reprocessPendingSyncEvents(actor: JwtPayload, limit = 25) {
    const events = await this.prisma.offlineSyncEvent.findMany({
      where: {
        status: { in: [OfflineSyncStatus.PENDENTE, OfflineSyncStatus.FALHOU, OfflineSyncStatus.CONFLITO] },
        entidadeTipo: EntidadeSincronizavel.FISCALIZACAO,
      },
      orderBy: { recebidoEm: 'asc' },
      take: limit,
    });

    let processados = 0;
    let sucesso = 0;
    let falhas = 0;
    const erros: Array<{ id: string; erro: string }> = [];

    for (const event of events) {
      processados += 1;
      const user = await this.resolveSyncUser(event.usuarioId, actor);
      try {
        const dto = event.payload as unknown as MobileSyncFiscalizacaoDto;
        const result = await this.syncFiscalizacao(dto, user);
        if (result.status === 'sincronizado' || result.status === 'duplicado') {
          sucesso += 1;
        } else {
          falhas += 1;
        }
      } catch (error) {
        falhas += 1;
        erros.push({
          id: event.id,
          erro: error instanceof Error ? error.message : 'Erro desconhecido',
        });
      }
    }

    return { processados, sucesso, falhas, erros };
  }

  private async resolveSyncUser(usuarioId: string | null, fallback: JwtPayload): Promise<JwtPayload> {
    if (!usuarioId) return fallback;

    const usuario = await this.prisma.usuario.findUnique({
      where: { id: usuarioId },
      select: {
        id: true,
        email: true,
        nome: true,
        perfis: {
          select: {
            perfil: {
              select: {
                nome: true,
                permissoes: { select: { permissao: { select: { chave: true } } } },
              },
            },
          },
        },
      },
    });

    if (!usuario) return fallback;

    return {
      sub: usuario.id,
      email: usuario.email,
      nome: usuario.nome,
      perfis: usuario.perfis.map((item) => item.perfil.nome),
      permissoes: Array.from(
        new Set(
          usuario.perfis.flatMap((item) =>
            item.perfil.permissoes.map((perfilPermissao) => perfilPermissao.permissao.chave),
          ),
        ),
      ),
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
