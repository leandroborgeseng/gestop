import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user';
import { JwtPayload } from '../auth/jwt';
import { SecretariaIdsQuery } from '../auth/secretaria-ids.query';
import { RequirePermissions } from '../auth/permissions';
import { PermissionsGuard } from '../auth/permissions.guard';
import { DashboardFiltroDto } from './monitoramento.dto';
import { MonitoramentoService } from './monitoramento.service';

@UseGuards(AuthGuard, PermissionsGuard)
@Controller('monitoramento')
export class MonitoramentoController {
  constructor(private readonly monitoramentoService: MonitoramentoService) {}

  @RequirePermissions('dashboard.visualizar')
  @Get('dashboard')
  getDashboard(@Query() filtro: DashboardFiltroDto, @CurrentUser() user: JwtPayload) {
    return this.monitoramentoService.getDashboard(filtro, user);
  }

  @RequirePermissions('auditoria.visualizar')
  @Get('auditoria')
  listAuditoria(@CurrentUser() user: JwtPayload) {
    return this.monitoramentoService.listAuditoria(user);
  }

  @RequirePermissions('dashboard.visualizar')
  @Get('alertas')
  getAlertas(@CurrentUser() user: JwtPayload, @SecretariaIdsQuery() secretariaId: string[]) {
    return this.monitoramentoService.getAlertasOperacionais(user, secretariaId);
  }
}
