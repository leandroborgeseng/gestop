import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaService } from '../prisma/prisma.service';
import { MonitoramentoController } from './monitoramento.controller';
import { MonitoramentoService } from './monitoramento.service';

@Module({
  imports: [AuthModule],
  controllers: [MonitoramentoController],
  providers: [MonitoramentoService, PrismaService],
  exports: [MonitoramentoService],
})
export class MonitoramentoModule {}
