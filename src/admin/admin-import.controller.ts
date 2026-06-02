import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user';
import { JwtPayload } from '../auth/jwt';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../auth/permissions';
import { AdminImportService } from './admin-import.service';

type WebmapSyncBody = {
  dryRun?: boolean;
};

@UseGuards(AuthGuard, PermissionsGuard)
@Controller('admin/importacao')
export class AdminImportController {
  constructor(private readonly adminImportService: AdminImportService) {}

  @RequirePermissions('unidades.gerenciar')
  @Get('webmap/status')
  getWebmapStatus() {
    return this.adminImportService.getWebmapStatus();
  }

  @RequirePermissions('unidades.gerenciar')
  @Post('webmap/sync')
  syncWebmap(@Body() body: WebmapSyncBody, @CurrentUser() user: JwtPayload) {
    return this.adminImportService.syncWebmap(user, Boolean(body.dryRun));
  }
}
