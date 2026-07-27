import { Body, Controller, Get, Post, Put, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user';
import { JwtPayload } from '../auth/jwt';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../auth/permissions';
import { BackupRestoreDto, BackupS3ConfigDto } from './backup.dto';
import { BackupService } from './backup.service';

@UseGuards(AuthGuard, PermissionsGuard)
@RequirePermissions('usuarios.gerenciar')
@Controller('admin/backup')
export class BackupController {
  constructor(private readonly backupService: BackupService) {}

  @Get()
  getStatus() {
    return this.backupService.getStatus();
  }

  @Put()
  saveConfig(@Body() body: BackupS3ConfigDto, @CurrentUser() user: JwtPayload) {
    return this.backupService.saveConfig(body, user);
  }

  @Post('run')
  runNow(@CurrentUser() user: JwtPayload) {
    return this.backupService.runNow(user);
  }

  @Get('objects')
  listBackups() {
    return this.backupService.listBackups();
  }

  @Post('restore')
  restore(@Body() body: BackupRestoreDto, @CurrentUser() user: JwtPayload) {
    return this.backupService.restore(body, user);
  }
}
