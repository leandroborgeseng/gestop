import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OperacionalController } from './operacional.controller';
import { OperacionalService } from './operacional.service';

@Module({
  controllers: [OperacionalController],
  providers: [OperacionalService, PrismaService],
})
export class OperacionalModule {}
