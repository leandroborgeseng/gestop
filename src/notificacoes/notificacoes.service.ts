import { Injectable, Logger, OnModuleInit, ForbiddenException } from '@nestjs/common';
import webpush from 'web-push';
import { EmailService } from '../email/email.service';
import { IntegracoesService } from '../integracoes/integracoes.service';
import { MonitoramentoService } from '../monitoramento/monitoramento.service';
import { PrismaService } from '../prisma/prisma.service';
import { PushSubscribeDto, PushUnsubscribeDto } from './notificacoes.dto';
import { isWebPushConfigured, resolveVapidKeys } from './push.vapid';

@Injectable()
export class NotificacoesService implements OnModuleInit {
  private readonly logger = new Logger(NotificacoesService.name);
  private intervalHandle: NodeJS.Timeout | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly monitoramentoService: MonitoramentoService,
    private readonly integracoesService: IntegracoesService,
    private readonly emailService: EmailService,
  ) {}

  onModuleInit() {
    const vapid = resolveVapidKeys();
    if (vapid) {
      webpush.setVapidDetails(vapid.subject, vapid.publicKey, vapid.privateKey);
    }

    const intervalMs = Number(process.env.ALERTAS_INTERVAL_MS ?? 6 * 60 * 60 * 1000);
    if (intervalMs > 0) {
      this.intervalHandle = setInterval(() => {
        void this.dispararAlertasOperacionais('scheduler').catch((error) => {
          this.logger.error('Falha no disparo agendado de alertas', error instanceof Error ? error.stack : error);
        });
      }, intervalMs);
      this.logger.log(`Alertas operacionais agendados a cada ${intervalMs}ms`);
    }
  }

  getVapidPublicKey() {
    return { publicKey: resolveVapidKeys()?.publicKey ?? null, enabled: isWebPushConfigured() };
  }

  async subscribePush(usuarioId: string, dto: PushSubscribeDto) {
    const existing = await this.prisma.pushSubscription.findUnique({
      where: { endpoint: dto.endpoint },
      select: { usuarioId: true },
    });

    if (existing && existing.usuarioId !== usuarioId) {
      throw new ForbiddenException('Este dispositivo já está registrado para outro usuário.');
    }

    return this.prisma.pushSubscription.upsert({
      where: { endpoint: dto.endpoint },
      create: {
        usuarioId,
        endpoint: dto.endpoint,
        p256dh: dto.keys.p256dh,
        auth: dto.keys.auth,
      },
      update: {
        usuarioId,
        p256dh: dto.keys.p256dh,
        auth: dto.keys.auth,
      },
    });
  }

  async unsubscribePush(usuarioId: string, dto: PushUnsubscribeDto) {
    await this.prisma.pushSubscription.deleteMany({
      where: { endpoint: dto.endpoint, usuarioId },
    });
    return { ok: true };
  }

  async dispararAlertasOperacionais(origem: 'manual' | 'scheduler' = 'manual') {
    const alertas = await this.monitoramentoService.getAlertasOperacionais();
    const total =
      alertas.resumo.chamadosAtrasados +
      alertas.resumo.chamadosSemTriagem +
      alertas.resumo.syncFalhas +
      alertas.resumo.chamadosUrgentes;

    if (total === 0) {
      return { enviados: 0, webhook: false, push: 0, origem, resumo: alertas.resumo };
    }

    const titulo = 'GestOP — Alertas operacionais';
    const corpo = [
      alertas.resumo.chamadosAtrasados ? `${alertas.resumo.chamadosAtrasados} chamados atrasados` : null,
      alertas.resumo.chamadosSemTriagem ? `${alertas.resumo.chamadosSemTriagem} chamados parados` : null,
      alertas.resumo.chamadosUrgentes ? `${alertas.resumo.chamadosUrgentes} chamados urgentes` : null,
      alertas.resumo.syncFalhas ? `${alertas.resumo.syncFalhas} falhas de sync` : null,
    ]
      .filter(Boolean)
      .join(' · ');

    const webhook = await this.integracoesService.notifySystem('alertas.operacionais', {
      origem,
      resumo: alertas.resumo,
      chamadosAtrasados: alertas.chamadosAtrasados.slice(0, 5),
      chamadosSemTriagem: alertas.chamadosSemTriagem.slice(0, 5),
    });

    const push = await this.sendPushToGestores(titulo, corpo, '/dashboard');
    const emails = await this.sendEmailAlertasToGestores(titulo, corpo, alertas.resumo);

    return {
      enviados: total,
      webhook: webhook.delivered,
      push,
      emails,
      origem,
      resumo: alertas.resumo,
    };
  }

  private async sendPushToGestores(title: string, body: string, url: string) {
    if (!isWebPushConfigured()) return 0;

    const subscriptions = await this.prisma.pushSubscription.findMany({
      where: {
        usuario: {
          ativo: true,
          perfis: {
            some: {
              perfil: {
                permissoes: {
                  some: { permissao: { chave: 'dashboard.visualizar' } },
                },
              },
            },
          },
        },
      },
    });

    let sent = 0;
    for (const subscription of subscriptions) {
      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: { p256dh: subscription.p256dh, auth: subscription.auth },
          },
          JSON.stringify({ title, body, url }),
        );
        sent += 1;
      } catch (error) {
        const statusCode = (error as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) {
          await this.prisma.pushSubscription.delete({ where: { id: subscription.id } });
        }
        this.logger.warn(`Push falhou para ${subscription.endpoint}: ${error instanceof Error ? error.message : error}`);
      }
    }

    return sent;
  }

  private async sendEmailAlertasToGestores(
    title: string,
    body: string,
    resumo: Record<string, number>,
  ) {
    if (process.env.EMAIL_ALERTS_ENABLED !== 'true' || !this.emailService.isConfigured()) {
      return 0;
    }

    const gestores = await this.prisma.usuario.findMany({
      where: {
        ativo: true,
        perfis: {
          some: {
            perfil: {
              permissoes: {
                some: { permissao: { chave: 'dashboard.visualizar' } },
              },
            },
          },
        },
      },
      select: { email: true, nome: true },
    });

    let sent = 0;
    for (const gestor of gestores) {
      const result = await this.emailService.send({
        to: gestor.email,
        subject: title,
        text: `${body}\n\nResumo: ${JSON.stringify(resumo)}`,
        tags: ['alertas-operacionais'],
      });
      if (result.delivered) sent += 1;
    }

    return sent;
  }
}
