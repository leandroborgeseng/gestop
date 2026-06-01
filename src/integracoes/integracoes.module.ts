import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaService } from '../prisma/prisma.service';
import { IntegracoesController } from './integracoes.controller';
import { IntegracoesService } from './integracoes.service';

@Module({
  imports: [AuthModule],
  controllers: [IntegracoesController],
  providers: [IntegracoesService, PrismaService],
  exports: [IntegracoesService],
})
export class IntegracoesModule {}
