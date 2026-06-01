import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AdminModule } from './admin/admin.module';
import { AuthModule } from './auth/auth.module';
import { ChecklistsModule } from './checklists/checklists.module';
import { HealthController, RootController } from './health.controller';
import { IntegracoesModule } from './integracoes/integracoes.module';
import { MobileModule } from './mobile/mobile.module';
import { MonitoramentoModule } from './monitoramento/monitoramento.module';
import { OperacionalModule } from './operacional/operacional.module';
import { OrdensServicoModule } from './ordens-servico/ordens-servico.module';
import { PrismaService } from './prisma/prisma.service';
import { StorageModule } from './storage/storage.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    AuthModule,
    AdminModule,
    ChecklistsModule,
    MobileModule,
    OrdensServicoModule,
    MonitoramentoModule,
    IntegracoesModule,
    OperacionalModule,
    StorageModule,
  ],
  controllers: [RootController, HealthController],
  providers: [PrismaService],
  exports: [PrismaService],
})
export class AppModule {}
