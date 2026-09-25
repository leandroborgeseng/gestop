import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { withChamadoOperacionalFilter } from '../chamados/chamado-visibilidade';

function maskDatabaseUrl(url: string) {
  try {
    const parsed = new URL(url);
    if (parsed.password) {
      parsed.password = '****';
    }
    return parsed.toString();
  } catch {
    return '(url invalida)';
  }
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private connected = false;
  private static bootLogged = false;

  constructor() {
    const connectionString =
      process.env.DATABASE_URL ?? 'postgresql://gestop:gestop@localhost:5432/gestop?schema=public';

    super({
      adapter: new PrismaPg({ connectionString }),
    });

    const extended = withChamadoOperacionalFilter(this) as this;
    const lifecycle = new Set(['onModuleInit', 'onModuleDestroy', 'isConnected']);
    return new Proxy(this, {
      get(target, prop, receiver) {
        if (typeof prop === 'string' && lifecycle.has(prop)) {
          const value = Reflect.get(target, prop, receiver);
          return typeof value === 'function' ? value.bind(target) : value;
        }
        const value = Reflect.get(extended, prop, extended);
        return typeof value === 'function' ? value.bind(extended) : value;
      },
    });
  }

  async onModuleInit() {
    try {
      await this.$connect();
      this.connected = true;

      if (!PrismaService.bootLogged) {
        PrismaService.bootLogged = true;
        const connectionString =
          process.env.DATABASE_URL ?? 'postgresql://gestop:gestop@localhost:5432/gestop?schema=public';
        console.log(`[SIGMA:prisma] DATABASE_URL=${maskDatabaseUrl(connectionString)}`);
        const users = await this.usuario.count();
        console.log(`[SIGMA:prisma] Conexao OK. Usuarios no banco: ${users}`);
      }
    } catch (error) {
      this.connected = false;
      console.warn(
        '[SIGMA:prisma] Banco indisponivel no boot. A API subiu, mas endpoints com dados falharao.',
      );
      console.warn(error);
    }
  }

  isConnected() {
    return this.connected;
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
