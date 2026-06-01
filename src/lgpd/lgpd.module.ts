import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaService } from '../prisma/prisma.service';
import { LgpdController } from './lgpd.controller';
import { LgpdService } from './lgpd.service';

@Module({
  imports: [AuthModule],
  controllers: [LgpdController],
  providers: [LgpdService, PrismaService],
})
export class LgpdModule {}
