import { Body, Controller, Get, Headers, Post, Req, UseGuards } from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user';
import { JwtPayload } from '../auth/jwt';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../auth/permissions';
import { AdminImportService } from './admin-import.service';

type WebmapSyncBody = {
  dryRun?: boolean;
};

type WebmapSyncAllBody = {
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

  @RequirePermissions('unidades.gerenciar')
  @Post('webmap/sync-all')
  syncAll(@Body() body: WebmapSyncAllBody, @CurrentUser() user: JwtPayload) {
    return this.adminImportService.syncAll(user, Boolean(body.dryRun));
  }

  @RequirePermissions('unidades.gerenciar')
  @Post('secretarias/sync')
  syncSecretarias(@Body() body: WebmapSyncBody) {
    return this.adminImportService.importSecretarias(Boolean(body.dryRun));
  }
}

@Controller('admin/importacao/webmap/automation')
export class AdminImportAutomationController {
  constructor(private readonly adminImportService: AdminImportService) {}

  @Post('cron')
  cronSync(@Headers('x-webmap-cron-secret') cronSecret: string | undefined) {
    this.adminImportService.validateCronSecret(cronSecret);
    return this.adminImportService.runAutomatedSync('cron');
  }

  @Post('webhook')
  githubWebhook(
    @Req() request: RawBodyRequest<{ rawBody?: Buffer }>,
    @Headers('x-hub-signature-256') signature: string | undefined,
    @Body() body: { ref?: string; repository?: { full_name?: string } },
  ) {
    const rawBody = request.rawBody?.toString('utf8') ?? JSON.stringify(body);
    this.adminImportService.validateWebhook(rawBody, signature);

    if (body.ref && body.ref !== 'refs/heads/main') {
      return { ignored: true, reason: 'Branch ignorada' };
    }

    return this.adminImportService.runAutomatedSync('webhook');
  }
}
