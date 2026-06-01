import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { IntegracoesModule } from '../integracoes/integracoes.module';
import { MonitoramentoModule } from '../monitoramento/monitoramento.module';
import { PrismaService } from '../prisma/prisma.service';
import { NotificacoesController } from './notificacoes.controller';
import { NotificacoesService } from './notificacoes.service';

@Module({
  imports: [AuthModule, MonitoramentoModule, IntegracoesModule],
  controllers: [NotificacoesController],
  providers: [NotificacoesService, PrismaService],
  exports: [NotificacoesService],
})
export class NotificacoesModule {}
