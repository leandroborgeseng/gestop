import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaService } from '../prisma/prisma.service';
import { CronogramaController } from './cronograma.controller';
import { CronogramaService } from './cronograma.service';

@Module({
  imports: [AuthModule],
  controllers: [CronogramaController],
  providers: [CronogramaService, PrismaService],
  exports: [CronogramaService],
})
export class CronogramaModule {}
