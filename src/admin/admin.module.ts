import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaService } from '../prisma/prisma.service';
import { AdminController } from './admin.controller';
import { AdminImportController } from './admin-import.controller';
import { AdminImportService } from './admin-import.service';
import { AdminService } from './admin.service';

@Module({
  imports: [AuthModule],
  controllers: [AdminController, AdminImportController],
  providers: [AdminService, AdminImportService, PrismaService],
})
export class AdminModule {}
