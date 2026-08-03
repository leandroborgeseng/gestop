import { Body, Controller, Get, Post, Put, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user';
import { JwtPayload } from '../auth/jwt';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequireAnyPermissions } from '../auth/permissions';
import { adminTabPermissionKeys } from '../domain/admin-permissions';
import { BackupRestoreDto, BackupS3ConfigDto } from './backup.dto';
import { BackupService } from './backup.service';

@UseGuards(AuthGuard, PermissionsGuard)
@Controller('admin/backup')
export class BackupController {
  constructor(private readonly backupService: BackupService) {}

  @RequireAnyPermissions(...adminTabPermissionKeys('backup', 'visualizar'))
  @Get()
  getStatus() {
    return this.backupService.getStatus();
  }

  @RequireAnyPermissions(...adminTabPermissionKeys('backup', 'alterar'))
  @Put()
  saveConfig(@Body() body: BackupS3ConfigDto, @CurrentUser() user: JwtPayload) {
    return this.backupService.saveConfig(body, user);
  }

  @RequireAnyPermissions(...adminTabPermissionKeys('backup', 'executar'))
  @Post('run')
  runNow(@CurrentUser() user: JwtPayload) {
    return this.backupService.runNow(user);
  }

  @RequireAnyPermissions(...adminTabPermissionKeys('backup', 'visualizar'))
  @Get('objects')
  listBackups() {
    return this.backupService.listBackups();
  }

  @RequireAnyPermissions(...adminTabPermissionKeys('backup', 'executar'))
  @Post('restore')
  restore(@Body() body: BackupRestoreDto, @CurrentUser() user: JwtPayload) {
    return this.backupService.restore(body, user);
  }
}
