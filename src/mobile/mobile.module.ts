import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { OrdensServicoModule } from '../ordens-servico/ordens-servico.module';
import { PrismaService } from '../prisma/prisma.service';
import { MobileController } from './mobile.controller';
import { MobileService } from './mobile.service';

@Module({
  imports: [AuthModule, OrdensServicoModule],
  controllers: [MobileController],
  providers: [MobileService, PrismaService],
})
export class MobileModule {}
