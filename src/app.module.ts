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
import { OrdensServicoModule } from './ordens-servico/ordens-servico.module';
import { LgpdModule } from './lgpd/lgpd.module';
import { ChamadosModule } from './chamados/chamados.module';
import { RelatoriosModule } from './relatorios/relatorios.module';
import { NotificacoesModule } from './notificacoes/notificacoes.module';
import { CronogramaModule } from './cronograma/cronograma.module';
import { EmailModule } from './email/email.module';
import { PrismaService } from './prisma/prisma.service';
import { StorageModule } from './storage/storage.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 120 }]),
    EmailModule,
    AuthModule,
    AdminModule,
    ChecklistsModule,
    CronogramaModule,
    MobileModule,
    OrdensServicoModule,
    MonitoramentoModule,
    IntegracoesModule,
    OperacionalModule,
    StorageModule,
    LgpdModule,
    ChamadosModule,
    RelatoriosModule,
    NotificacoesModule,
  ],
  controllers: [RootController, HealthController],
  providers: [
    PrismaService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_FILTER, useClass: GlobalHttpExceptionFilter },
  ],
  exports: [PrismaService],
})
export class AppModule {}
