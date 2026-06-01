import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user';
import { JwtPayload } from '../auth/jwt';
import { RequirePermissions } from '../auth/permissions';
import { PermissionsGuard } from '../auth/permissions.guard';
import { PushSubscribeDto, PushUnsubscribeDto } from './notificacoes.dto';
import { NotificacoesService } from './notificacoes.service';

@Controller('notificacoes')
export class NotificacoesController {
  constructor(private readonly notificacoesService: NotificacoesService) {}

  @Get('push/vapid-public-key')
  getVapidPublicKey() {
    return this.notificacoesService.getVapidPublicKey();
  }

  @UseGuards(AuthGuard, PermissionsGuard)
  @RequirePermissions('dashboard.visualizar')
  @Post('push/subscribe')
  subscribe(@Body() body: PushSubscribeDto, @CurrentUser() user: JwtPayload) {
    return this.notificacoesService.subscribePush(user.sub, body);
  }

  @UseGuards(AuthGuard, PermissionsGuard)
  @RequirePermissions('dashboard.visualizar')
  @Post('push/unsubscribe')
  unsubscribe(@Body() body: PushUnsubscribeDto, @CurrentUser() user: JwtPayload) {
    return this.notificacoesService.unsubscribePush(user.sub, body);
  }

  @UseGuards(AuthGuard, PermissionsGuard)
  @RequirePermissions('dashboard.visualizar')
  @Post('alertas/disparar')
  dispararAlertas() {
    return this.notificacoesService.dispararAlertasOperacionais('manual');
  }
}
