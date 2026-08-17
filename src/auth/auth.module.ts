import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuditModule } from '../audit/audit.module';
import { AuthController } from './auth.controller';
import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';
import { PermissionsGuard } from './permissions.guard';

@Module({
  imports: [ConfigModule, AuditModule],
  controllers: [AuthController],
  providers: [AuthService, AuthGuard, PermissionsGuard],
  exports: [AuthService, AuthGuard, PermissionsGuard],
})
export class AuthModule {}
