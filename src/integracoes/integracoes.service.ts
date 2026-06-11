import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit, forwardRef } from '@nestjs/common';
import { AuditAction, OfflineSyncStatus } from '@prisma/client';
import { JwtPayload } from '../auth/jwt';
import { MobileService } from '../mobile/mobile.service';
import { PrismaService } from '../prisma/prisma.service';

const SYSTEM_SYNC_ACTOR: JwtPayload = {
  sub: 'system-sync-replay',
  email: 'system@gestop.local',
  nome: 'GestOP Sync Scheduler',
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

  async listEventosTecnicos() {
    const [syncFalhas, auditoriaIntegracoes] = await Promise.all([
      this.prisma.offlineSyncEvent.findMany({
        where: { status: { in: [OfflineSyncStatus.CONFLITO, OfflineSyncStatus.FALHOU, OfflineSyncStatus.PENDENTE] } },
        orderBy: { recebidoEm: 'desc' },
        take: 50,
      }),
      this.prisma.logAuditoria.findMany({
        where: { entidadeTipo: { in: ['Integracao', 'Notificacao'] } },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
    ]);

    return { syncFalhas, auditoriaIntegracoes };
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
    const result = await this.prisma.offlineSyncEvent.updateMany({
      where: { status: { in: [OfflineSyncStatus.CONFLITO, OfflineSyncStatus.FALHOU] } },
      data: {
        status: OfflineSyncStatus.PENDENTE,
        ultimoErro: null,
        conflitoMotivo: null,
        tentativas: { increment: 1 },
      },
    });

    const replay = await this.mobileService.reprocessPendingSyncEvents(user);

    await this.prisma.logAuditoria.create({
      data: {
        usuarioId: user.sub,
        acao: AuditAction.SYNC,
        entidadeTipo: 'Integracao',
        entidadeId: 'retry-offline-sync',
        valorNovo: { reenfileirados: result.count, replay },
      },
    });

    return { reenfileirados: result.count, ...replay };
  }
}
