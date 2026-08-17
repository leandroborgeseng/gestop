import { BadRequestException, Inject, Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit, forwardRef } from '@nestjs/common';
import { AuditAction, OfflineSyncStatus, Prisma } from '@prisma/client';
import { JwtPayload } from '../auth/jwt';
import { AuditService } from '../audit/audit.service';
import { MobileService } from '../mobile/mobile.service';
import { PrismaService } from '../prisma/prisma.service';

const SYSTEM_SYNC_ACTOR: JwtPayload = {
  sub: 'system-sync-replay',
  email: 'system@gestop.local',
  nome: 'SIGMA Sync Scheduler',
  perfis: [],
  permissoes: [],
};

type NotifyResult = {
  adapter: 'webhook' | 'mock';
  delivered: boolean;
  evento: string;
  statusCode?: number;
  error?: string;
};

@Injectable()
export class IntegracoesService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(IntegracoesService.name);
  private syncReplayHandle: NodeJS.Timeout | null = null;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => MobileService))
    private readonly mobileService: MobileService,
    private readonly auditService: AuditService,
  ) {}

  onModuleInit() {
    const intervalMs = Number(process.env.SYNC_REPLAY_INTERVAL_MS ?? 30 * 60 * 1000);
    if (intervalMs > 0) {
      this.syncReplayHandle = setInterval(() => {
        void this.runScheduledSyncReplay().catch((error) => {
          this.logger.error(
            'Falha no replay agendado de sync offline',
            error instanceof Error ? error.stack : error,
          );
        });
      }, intervalMs);
      this.logger.log(`Replay automatico de sync offline a cada ${intervalMs}ms`);
    }
  }

  onModuleDestroy() {
    if (this.syncReplayHandle) {
      clearInterval(this.syncReplayHandle);
    }
  }

  private async runScheduledSyncReplay() {
    const pending = await this.prisma.offlineSyncEvent.count({
      where: {
        status: { in: [OfflineSyncStatus.PENDENTE, OfflineSyncStatus.FALHOU, OfflineSyncStatus.CONFLITO] },
      },
    });

    if (pending === 0) {
      return;
    }

    const replay = await this.mobileService.reprocessPendingSyncEvents(SYSTEM_SYNC_ACTOR);
    if (replay.processados > 0) {
      this.logger.log(
        `Replay automatico: ${replay.sucesso}/${replay.processados} eventos processados (${replay.falhas} falhas)`,
      );
    }
  }

  async listEventosTecnicos(query: {
    falhasStatus?: string;
    falhasSearch?: string;
    falhasLimit?: number;
    falhasOffset?: number;
    notificacoesSearch?: string;
    notificacoesLimit?: number;
    notificacoesOffset?: number;
  } = {}) {
    const falhasLimit = Math.min(Math.max(query.falhasLimit ?? 50, 1), 500);
    const falhasOffset = Math.max(query.falhasOffset ?? 0, 0);
    const notificacoesLimit = Math.min(Math.max(query.notificacoesLimit ?? 50, 1), 500);
    const notificacoesOffset = Math.max(query.notificacoesOffset ?? 0, 0);
    const falhasStatus = (query.falhasStatus ?? 'PENDENTE').toUpperCase();
    const falhasSearch = query.falhasSearch?.trim();
    const notificacoesSearch = query.notificacoesSearch?.trim();

    const falhasWhere = this.buildFalhasWhere(falhasStatus, falhasSearch);
    const notificacoesWhere: Prisma.LogAuditoriaWhereInput = {
      entidadeTipo: { in: ['Integracao', 'Notificacao'] },
      ...(notificacoesSearch
        ? {
            OR: [
              { entidadeId: { contains: notificacoesSearch, mode: 'insensitive' } },
              { descricao: { contains: notificacoesSearch, mode: 'insensitive' } },
              { usuario: { nome: { contains: notificacoesSearch, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };

    const [syncFalhas, falhasTotal, counts, auditoriaIntegracoes, notificacoesTotal] = await Promise.all([
      this.prisma.offlineSyncEvent.findMany({
        where: falhasWhere,
        orderBy: { recebidoEm: 'desc' },
        take: falhasLimit,
        skip: falhasOffset,
        include: {
          usuario: { select: { id: true, nome: true, email: true } },
          ignoradoPor: { select: { id: true, nome: true, email: true } },
        },
      }),
      this.prisma.offlineSyncEvent.count({ where: falhasWhere }),
      this.prisma.offlineSyncEvent.groupBy({
        by: ['status'],
        _count: { _all: true },
      }),
      this.prisma.logAuditoria.findMany({
        where: notificacoesWhere,
        orderBy: { createdAt: 'desc' },
        take: notificacoesLimit,
        skip: notificacoesOffset,
        include: { usuario: { select: { id: true, nome: true, email: true } } },
      }),
      this.prisma.logAuditoria.count({ where: notificacoesWhere }),
    ]);

    const countByStatus = Object.fromEntries(counts.map((item) => [item.status, item._count._all])) as Record<string, number>;
    const pendentes =
      (countByStatus.PENDENTE ?? 0) + (countByStatus.FALHOU ?? 0) + (countByStatus.CONFLITO ?? 0) + (countByStatus.PROCESSANDO ?? 0);

    return {
      syncFalhas: syncFalhas.map((item) => this.serializeFalha(item)),
      falhasTotal,
      falhasLimit,
      falhasOffset,
      falhasHasMore: falhasOffset + syncFalhas.length < falhasTotal,
      counts: {
        pendentes,
        ignoradas: countByStatus.IGNORADO ?? 0,
        resolvidas: countByStatus.SINCRONIZADO ?? 0,
      },
      auditoriaIntegracoes: auditoriaIntegracoes.map((item) => this.serializeNotificacao(item)),
      notificacoesTotal,
      notificacoesLimit,
      notificacoesOffset,
      notificacoesHasMore: notificacoesOffset + auditoriaIntegracoes.length < notificacoesTotal,
    };
  }

  private buildFalhasWhere(status: string, search?: string): Prisma.OfflineSyncEventWhereInput {
    const statusFilter =
      status === 'TODAS'
        ? {}
        : status === 'PENDENTE'
          ? { status: { in: [OfflineSyncStatus.PENDENTE, OfflineSyncStatus.FALHOU, OfflineSyncStatus.CONFLITO, OfflineSyncStatus.PROCESSANDO] } }
          : status === 'IGNORADA' || status === 'IGNORADO'
            ? { status: OfflineSyncStatus.IGNORADO }
            : status === 'RESOLVIDA' || status === 'SINCRONIZADO'
              ? { status: OfflineSyncStatus.SINCRONIZADO }
              : { status: { in: [OfflineSyncStatus.PENDENTE, OfflineSyncStatus.FALHOU, OfflineSyncStatus.CONFLITO] } };

    if (!search) return statusFilter;

    return {
      AND: [
        statusFilter,
        {
          OR: [
            { clientEventId: { contains: search, mode: 'insensitive' } },
            { deviceId: { contains: search, mode: 'insensitive' } },
            { conflitoMotivo: { contains: search, mode: 'insensitive' } },
            { ultimoErro: { contains: search, mode: 'insensitive' } },
            { entidadeId: { contains: search, mode: 'insensitive' } },
            { usuario: { nome: { contains: search, mode: 'insensitive' } } },
            { justificativaIgnorar: { contains: search, mode: 'insensitive' } },
          ],
        },
      ],
    };
  }

  private serializeFalha(item: {
    id: string;
    clientEventId: string;
    deviceId: string;
    usuarioId: string | null;
    entidadeTipo: string;
    entidadeId: string | null;
    operacao: string;
    payload: Prisma.JsonValue;
    status: string;
    conflitoMotivo: string | null;
    resolucao: Prisma.JsonValue | null;
    ocorridoEm: Date;
    recebidoEm: Date;
    sincronizadoEm: Date | null;
    resolvidoEm: Date | null;
    tentativas: number;
    ultimoErro: string | null;
    ignoradoEm: Date | null;
    justificativaIgnorar: string | null;
    usuario: { id: string; nome: string; email: string } | null;
    ignoradoPor: { id: string; nome: string; email: string } | null;
  }) {
    const payload = (item.payload ?? {}) as Record<string, unknown>;
    return {
      id: item.id,
      clientEventId: item.clientEventId,
      deviceId: item.deviceId,
      status: item.status,
      tipo: item.entidadeTipo,
      operacao: item.operacao,
      origem: 'Sincronização offline',
      usuario: item.usuario,
      secretariaAtiva: typeof payload.secretariaAtivaSigla === 'string' ? payload.secretariaAtivaSigla : payload.secretariaId ?? null,
      unidadeId: payload.unidadeId ?? null,
      checklistId: payload.checklistId ?? null,
      chamadoId: payload.chamadoId ?? null,
      ocorridoEm: item.ocorridoEm,
      recebidoEm: item.recebidoEm,
      sincronizadoEm: item.sincronizadoEm,
      tentativas: item.tentativas,
      conflitoMotivo: item.conflitoMotivo,
      ultimoErro: item.ultimoErro,
      entidadeId: item.entidadeId,
      ignoradoEm: item.ignoradoEm,
      ignoradoPor: item.ignoradoPor,
      justificativaIgnorar: item.justificativaIgnorar,
      payloadResumo: summarizePayload(payload),
    };
  }

  private serializeNotificacao(item: {
    id: string;
    acao: string;
    entidadeTipo: string;
    entidadeId: string | null;
    createdAt: Date;
    descricao: string | null;
    tela: string | null;
    funcao: string | null;
    usuario: { id: string; nome: string; email: string } | null;
    valorNovo: Prisma.JsonValue | null;
  }) {
    const valor = (item.valorNovo ?? {}) as Record<string, unknown>;
    const payload = (valor.payload as Record<string, unknown> | undefined) ?? valor;
    return {
      id: item.id,
      tipo: item.entidadeTipo,
      acao: item.acao,
      evento: item.entidadeId,
      origem: item.tela ?? item.entidadeTipo,
      usuario: item.usuario,
      createdAt: item.createdAt,
      descricao: item.descricao,
      delivered: valor.delivered ?? null,
      adapter: valor.adapter ?? null,
      chamadoId: payload.chamadoId ?? valor.chamadoId ?? null,
      codigo: payload.codigo ?? valor.codigo ?? null,
      documentoId: payload.documentoId ?? valor.documentoId ?? null,
      fiscalizacaoId: payload.fiscalizacaoId ?? valor.fiscalizacaoId ?? null,
      detalhes: valor,
    };
  }

  async notify(evento: string, payload: unknown, user: JwtPayload) {
    const result = await this.dispatchNotification(evento, payload);

    await this.prisma.logAuditoria.create({
      data: {
        usuarioId: user.sub,
        acao: AuditAction.CREATE,
        entidadeTipo: 'Notificacao',
        entidadeId: evento,
        valorNovo: JSON.parse(JSON.stringify(result)),
      },
    });

    return result;
  }

  /** @deprecated Use notify() */
  async notifyMock(evento: string, payload: unknown, user: JwtPayload) {
    return this.notify(evento, payload, user);
  }

  /** Notificacao sem usuario autenticado (ex.: chamado publico QR). */
  async notifySystem(evento: string, payload: unknown) {
    const result = await this.dispatchNotification(evento, payload);

    await this.prisma.logAuditoria.create({
      data: {
        acao: AuditAction.CREATE,
        entidadeTipo: 'Notificacao',
        entidadeId: evento,
        valorNovo: JSON.parse(JSON.stringify(result)),
      },
    });

    return result;
  }

  private async dispatchNotification(evento: string, payload: unknown): Promise<NotifyResult> {
    const webhookUrl = process.env.INTEGRACOES_WEBHOOK_URL?.trim();

    if (!webhookUrl) {
      this.logger.warn(`Webhook nao configurado; notificacao mock para evento ${evento}`);
      return { adapter: 'mock', delivered: true, evento };
    }

    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(process.env.INTEGRACOES_WEBHOOK_SECRET
            ? { 'x-gestop-secret': process.env.INTEGRACOES_WEBHOOK_SECRET }
            : {}),
        },
        body: JSON.stringify({
          source: 'gestop',
          evento,
          payload,
          emittedAt: new Date().toISOString(),
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        return {
          adapter: 'webhook',
          delivered: false,
          evento,
          statusCode: response.status,
          error: error.slice(0, 500),
        };
      }

      return { adapter: 'webhook', delivered: true, evento, statusCode: response.status };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro desconhecido';
      this.logger.error(`Falha ao enviar webhook (${evento}): ${message}`);
      return { adapter: 'webhook', delivered: false, evento, error: message };
    }
  }

  async retryFailedSync(user: JwtPayload) {
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const staleEvents = await this.prisma.offlineSyncEvent.findMany({
      where: {
        status: { in: [OfflineSyncStatus.PENDENTE, OfflineSyncStatus.FALHOU, OfflineSyncStatus.CONFLITO] },
        recebidoEm: { gte: cutoff },
      },
      orderBy: { recebidoEm: 'asc' },
      take: 100,
      select: { id: true },
    });

    const result =
      staleEvents.length === 0
        ? { count: 0 }
        : await this.prisma.offlineSyncEvent.updateMany({
            where: { id: { in: staleEvents.map((event) => event.id) } },
            data: {
              status: OfflineSyncStatus.PENDENTE,
              ultimoErro: null,
              conflitoMotivo: null,
              tentativas: { increment: 1 },
            },
          });

    const replay = await this.mobileService.reprocessPendingSyncEvents(user);

    await this.auditService.record({
      user,
      acao: AuditAction.SYNC,
      entidadeTipo: 'Integracao',
      entidadeId: 'retry-offline-sync',
      tela: 'integracoes',
      funcao: 'monitorar',
      descricao: `Retentativa em lote: ${result.count} reenfileirado(s)`,
      valorNovo: { reenfileirados: result.count, replay },
    });

    return { reenfileirados: result.count, ...replay };
  }

  async retrySyncEvent(id: string, user: JwtPayload) {
    const event = await this.prisma.offlineSyncEvent.findUnique({ where: { id } });
    if (!event) throw new NotFoundException('Falha de sincronização não encontrada.');
    const anterior = event.status;

    await this.prisma.offlineSyncEvent.update({
      where: { id },
      data: {
        status: OfflineSyncStatus.PENDENTE,
        ultimoErro: null,
        conflitoMotivo: null,
        tentativas: { increment: 1 },
      },
    });

    const replay = await this.mobileService.reprocessSyncEventById(id, user);
    const atual = await this.prisma.offlineSyncEvent.findUnique({ where: { id } });

    await this.auditService.record({
      user,
      acao: AuditAction.SYNC,
      entidadeTipo: 'OfflineSyncEvent',
      entidadeId: id,
      tela: 'integracoes',
      funcao: 'monitorar',
      descricao: `Retentativa individual da falha ${event.clientEventId}`,
      valorAntigo: { status: anterior },
      valorNovo: { status: atual?.status, replay },
    });

    return { id, anterior, atual: atual?.status, ...replay };
  }

  async ignoreSyncEvent(id: string, justificativa: string | undefined, user: JwtPayload) {
    const event = await this.prisma.offlineSyncEvent.findUnique({ where: { id } });
    if (!event) throw new NotFoundException('Falha de sincronização não encontrada.');
    if (event.status === OfflineSyncStatus.SINCRONIZADO) {
      throw new BadRequestException('Falha já resolvida não pode ser ignorada.');
    }
    const anterior = event.status;
    const updated = await this.prisma.offlineSyncEvent.update({
      where: { id },
      data: {
        status: OfflineSyncStatus.IGNORADO,
        ignoradoEm: new Date(),
        ignoradoPorId: user.sub,
        justificativaIgnorar: justificativa?.trim() || null,
      },
    });

    await this.auditService.record({
      user,
      acao: AuditAction.UPDATE,
      entidadeTipo: 'OfflineSyncEvent',
      entidadeId: id,
      tela: 'integracoes',
      funcao: 'monitorar',
      descricao: `Falha ${event.clientEventId} marcada como ignorada`,
      valorAntigo: { status: anterior },
      valorNovo: { status: updated.status, justificativa: justificativa?.trim() || null },
    });

    return this.serializeFalha(
      await this.prisma.offlineSyncEvent.findUniqueOrThrow({
        where: { id },
        include: {
          usuario: { select: { id: true, nome: true, email: true } },
          ignoradoPor: { select: { id: true, nome: true, email: true } },
        },
      }),
    );
  }
}

function summarizePayload(payload: Record<string, unknown>) {
  const keys = ['unidadeId', 'unidadeNome', 'checklistId', 'checklistNome', 'chamadoId', 'codigo', 'secretariaId', 'origem'];
  const resumo: Record<string, unknown> = {};
  for (const key of keys) {
    if (payload[key] != null) resumo[key] = payload[key];
  }
  if (payload.checkin && typeof payload.checkin === 'object') resumo.checkin = payload.checkin;
  return resumo;
}
