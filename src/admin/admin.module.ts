import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { IntegracoesModule } from '../integracoes/integracoes.module';
import { PrismaService } from '../prisma/prisma.service';
import { AdminController } from './admin.controller';
import { AdminImportAutomationController, AdminImportController } from './admin-import.controller';
import { AdminImportService } from './admin-import.service';
import { AdminService } from './admin.service';

@Module({
  imports: [AuthModule, IntegracoesModule],
  controllers: [AdminController, AdminImportController, AdminImportAutomationController],
  providers: [AdminService, AdminImportService, PrismaService],
})
export class AdminModule {}
