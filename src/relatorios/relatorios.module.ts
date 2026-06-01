import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaService } from '../prisma/prisma.service';
import { RelatoriosController } from './relatorios.controller';
import { RelatoriosService } from './relatorios.service';

@Module({
  imports: [AuthModule],
  controllers: [RelatoriosController],
  providers: [RelatoriosService, PrismaService],
})
export class RelatoriosModule {}
