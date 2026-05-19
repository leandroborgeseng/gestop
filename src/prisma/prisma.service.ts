import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

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
  }

  async onModuleInit() {
    try {
      await this.$connect();
      this.connected = true;

      if (!PrismaService.bootLogged) {
        PrismaService.bootLogged = true;
        const connectionString =
          process.env.DATABASE_URL ?? 'postgresql://gestop:gestop@localhost:5432/gestop?schema=public';
        console.log(`[GestOP:prisma] DATABASE_URL=${maskDatabaseUrl(connectionString)}`);
        const users = await this.usuario.count();
        console.log(`[GestOP:prisma] Conexao OK. Usuarios no banco: ${users}`);
      }
    } catch (error) {
      this.connected = false;
      console.warn(
        '[GestOP:prisma] Banco indisponivel no boot. A API subiu, mas endpoints com dados falharao.',
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
