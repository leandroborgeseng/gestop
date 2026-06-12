import { Controller, Get } from '@nestjs/common';
import { getUptimeSeconds } from './config/runtime';
import { PrismaService } from './prisma/prisma.service';
import { inspectStorageHealth } from './storage/storage.health';

const APP_VERSION = process.env.npm_package_version ?? '1.0.0';

@Controller()
export class RootController {
  @Get()
  getRoot() {
    return {
      status: 'ok',
      service: 'sigma-api',
      message: 'SIGMA API online',
      health: '/health',
      dbHealth: '/health/db',
      docs: {
        login: 'POST /auth/login',
        cco: 'GET /operacional/resumo',
        mobile: 'GET /mobile/field-package',
      },
      timestamp: new Date().toISOString(),
    };
  }
}

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  getHealth() {
    return {
      status: 'ok',
      service: 'sigma-api',
      version: APP_VERSION,
      uptimeSeconds: getUptimeSeconds(),
      observability: {
        sentryConfigured: Boolean(process.env.SENTRY_DSN?.trim()),
        webhookConfigured: Boolean(process.env.INTEGRACOES_WEBHOOK_URL?.trim()),
        emailConfigured: Boolean(
          process.env.SMTP_HOST?.trim() ||
            process.env.EMAIL_WEBHOOK_URL?.trim() ||
            (process.env.EMAIL_DRIVER === 'webhook' && process.env.INTEGRACOES_WEBHOOK_URL?.trim()),
        ),
        webPushConfigured: Boolean(
          process.env.WEB_PUSH_VAPID_PUBLIC_KEY?.trim() && process.env.WEB_PUSH_VAPID_PRIVATE_KEY?.trim(),
        ),
        webmapCronConfigured: Boolean(process.env.WEBMAP_CRON_SECRET?.trim()),
      },
      timestamp: new Date().toISOString(),
    };
  }

  @Get('db')
  async getDatabaseHealth() {
    if (!this.prisma.isConnected()) {
      return {
        status: 'error',
        connected: false,
        message: 'Prisma nao conectou durante o boot da API.',
        timestamp: new Date().toISOString(),
      };
    }

    try {
      const [users, secretarias, migrations] = await Promise.all([
        this.prisma.usuario.count(),
        this.prisma.secretaria.count(),
        this.prisma.$queryRaw<Array<{ migration_name: string; finished_at: Date | null }>>`
          SELECT migration_name, finished_at
          FROM "_prisma_migrations"
          ORDER BY started_at
        `,
      ]);

      return {
        status: 'ok',
        connected: true,
        counts: {
          usuarios: users,
          secretarias,
          unidades: await this.prisma.unidadePublica.count({ where: { ativo: true } }),
          chamados: await this.prisma.chamado.count(),
        },
        migrations: migrations.map((item) => ({
          name: item.migration_name,
          applied: Boolean(item.finished_at),
        })),
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro desconhecido';
      return {
        status: 'error',
        connected: false,
        message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  @Get('storage')
  async getStorageHealth() {
    return inspectStorageHealth();
  }
}
