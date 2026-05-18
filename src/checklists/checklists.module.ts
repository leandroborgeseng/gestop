import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaService } from '../prisma/prisma.service';
import { ChecklistsController } from './checklists.controller';
import { ChecklistsService } from './checklists.service';

@Module({
  imports: [AuthModule],
  controllers: [ChecklistsController],
  providers: [ChecklistsService, PrismaService],
})
export class ChecklistsModule {}
