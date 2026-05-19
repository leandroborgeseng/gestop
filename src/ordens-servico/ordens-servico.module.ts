import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaService } from '../prisma/prisma.service';
import { OrdensServicoController } from './ordens-servico.controller';
import { OrdensServicoService } from './ordens-servico.service';

@Module({
  imports: [AuthModule],
  controllers: [OrdensServicoController],
  providers: [OrdensServicoService, PrismaService],
  exports: [OrdensServicoService],
})
export class OrdensServicoModule {}
