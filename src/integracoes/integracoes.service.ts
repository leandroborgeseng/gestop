import { Injectable } from '@nestjs/common';
import { AuditAction, OfflineSyncStatus } from '@prisma/client';
import { JwtPayload } from '../auth/jwt';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class IntegracoesService {
  constructor(private readonly prisma: PrismaService) {}

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

  async notifyMock(evento: string, payload: unknown, user: JwtPayload) {
    return this.prisma.logAuditoria.create({
      data: {
        usuarioId: user.sub,
        acao: AuditAction.CREATE,
        entidadeTipo: 'Notificacao',
        entidadeId: evento,
        valorNovo: JSON.parse(JSON.stringify({
          adapter: 'mock',
          delivered: true,
          evento,
          payload,
        })),
      },
    });
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

    await this.prisma.logAuditoria.create({
      data: {
        usuarioId: user.sub,
        acao: AuditAction.SYNC,
        entidadeTipo: 'Integracao',
        entidadeId: 'retry-offline-sync',
        valorNovo: { reenfileirados: result.count },
      },
    });

    return { reenfileirados: result.count };
  }
}
