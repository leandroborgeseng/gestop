import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user';
import { JwtPayload } from '../auth/jwt';
import { RequireAnyPermissions } from '../auth/permissions';
import { PermissionsGuard } from '../auth/permissions.guard';
import { permissionMatrixKey } from '../domain/permissions-catalog';
import { IntegracoesService } from './integracoes.service';

const INTEGRACOES_VIEW = [
  'auditoria.visualizar',
  permissionMatrixKey('integracoes', '_tela', 'visualizar'),
  permissionMatrixKey('integracoes', 'monitorar', 'visualizar'),
] as const;

const INTEGRACOES_EXEC = [
  permissionMatrixKey('integracoes', '_tela', 'executar'),
  permissionMatrixKey('integracoes', 'monitorar', 'executar'),
] as const;

@UseGuards(AuthGuard, PermissionsGuard)
@Controller('integracoes')
export class IntegracoesController {
  constructor(private readonly integracoesService: IntegracoesService) {}

  @RequireAnyPermissions(...INTEGRACOES_VIEW)
  @Get('eventos')
  listEventosTecnicos(
    @Query('falhasStatus') falhasStatus?: string,
    @Query('falhasSearch') falhasSearch?: string,
    @Query('falhasLimit') falhasLimit?: string,
    @Query('falhasOffset') falhasOffset?: string,
    @Query('notificacoesSearch') notificacoesSearch?: string,
    @Query('notificacoesLimit') notificacoesLimit?: string,
    @Query('notificacoesOffset') notificacoesOffset?: string,
  ) {
    return this.integracoesService.listEventosTecnicos({
      falhasStatus,
      falhasSearch,
      falhasLimit: falhasLimit ? Number(falhasLimit) : undefined,
      falhasOffset: falhasOffset ? Number(falhasOffset) : undefined,
      notificacoesSearch,
      notificacoesLimit: notificacoesLimit ? Number(notificacoesLimit) : undefined,
      notificacoesOffset: notificacoesOffset ? Number(notificacoesOffset) : undefined,
    });
  }

  @RequireAnyPermissions(...INTEGRACOES_EXEC)
  @Post('notificar')
  notify(@Body() body: { evento: string; payload: unknown }, @CurrentUser() user: JwtPayload) {
    return this.integracoesService.notify(body.evento, body.payload, user);
  }

  @RequireAnyPermissions(...INTEGRACOES_EXEC)
  @Post('sync/retry')
  retryFailedSync(@CurrentUser() user: JwtPayload) {
    return this.integracoesService.retryFailedSync(user);
  }

  @RequireAnyPermissions(...INTEGRACOES_EXEC)
  @Post('sync/:id/retry')
  retryOne(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.integracoesService.retrySyncEvent(id, user);
  }

  @RequireAnyPermissions(...INTEGRACOES_EXEC)
  @Post('sync/:id/ignorar')
  ignoreOne(
    @Param('id') id: string,
    @Body() body: { justificativa?: string },
    @CurrentUser() user: JwtPayload,
  ) {
    return this.integracoesService.ignoreSyncEvent(id, body.justificativa, user);
  }
}
