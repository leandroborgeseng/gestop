import { Controller, Get } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';

@Controller()
export class RootController {
  @Get()
  getRoot() {
    return {
      status: 'ok',
      service: 'gestop-api',
      message: 'GestOP API online',
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
      service: 'gestop-api',
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
}
