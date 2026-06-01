import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { IntegracoesModule } from '../integracoes/integracoes.module';
import { PrismaService } from '../prisma/prisma.service';
import { ChamadosController } from './chamados.controller';
import { ChamadosService } from './chamados.service';
import { PublicChamadosController } from './public-chamados.controller';

@Module({
  imports: [AuthModule, IntegracoesModule],
  controllers: [ChamadosController, PublicChamadosController],
  providers: [ChamadosService, PrismaService],
  exports: [ChamadosService],
})
export class ChamadosModule {}
