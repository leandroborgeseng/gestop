import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AdminModule } from './admin/admin.module';
import { AuthModule } from './auth/auth.module';
import { ChecklistsModule } from './checklists/checklists.module';
import { GlobalHttpExceptionFilter } from './common/http-exception.filter';
import { HealthController, RootController } from './health.controller';
import { IntegracoesModule } from './integracoes/integracoes.module';
import { MobileModule } from './mobile/mobile.module';
import { MonitoramentoModule } from './monitoramento/monitoramento.module';
import { OperacionalModule } from './operacional/operacional.module';
import { ChamadosModule } from './chamados/chamados.module';
import { RelatoriosModule } from './relatorios/relatorios.module';
import { NotificacoesModule } from './notificacoes/notificacoes.module';
import { CronogramaModule } from './cronograma/cronograma.module';
import { EmailModule } from './email/email.module';
import { FiscalizacoesModule } from './fiscalizacoes/fiscalizacoes.module';
import { PrismaModule } from './prisma/prisma.module';
import { StorageModule } from './storage/storage.module';
import { LgpdModule } from './lgpd/lgpd.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule,
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 120 }]),
    EmailModule,
    AuthModule,
    AdminModule,
    ChecklistsModule,
    CronogramaModule,
    MobileModule,
    MonitoramentoModule,
    IntegracoesModule,
    OperacionalModule,
    StorageModule,
    LgpdModule,
    ChamadosModule,
    FiscalizacoesModule,
    RelatoriosModule,
    NotificacoesModule,
  ],
  controllers: [RootController, HealthController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_FILTER, useClass: GlobalHttpExceptionFilter },
  ],
})
export class AppModule {}
