import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user';
import { JwtPayload } from '../auth/jwt';
import { RequirePermissions } from '../auth/permissions';
import { PermissionsGuard } from '../auth/permissions.guard';
import { IntegracoesService } from './integracoes.service';

@UseGuards(AuthGuard, PermissionsGuard)
@RequirePermissions('auditoria.visualizar')
@Controller('integracoes')
export class IntegracoesController {
  constructor(private readonly integracoesService: IntegracoesService) {}

  @Get('eventos')
  listEventosTecnicos() {
    return this.integracoesService.listEventosTecnicos();
  }

  @Post('notificar')
  notifyMock(@Body() body: { evento: string; payload: unknown }, @CurrentUser() user: JwtPayload) {
    return this.integracoesService.notifyMock(body.evento, body.payload, user);
  }

  @Post('sync/retry')
  retryFailedSync(@CurrentUser() user: JwtPayload) {
    return this.integracoesService.retryFailedSync(user);
  }
}
