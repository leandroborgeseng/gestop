import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
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
  getDashboard(@Query() filtro: DashboardFiltroDto) {
    return this.monitoramentoService.getDashboard(filtro);
  }

  @RequirePermissions('auditoria.visualizar')
  @Get('auditoria')
  listAuditoria() {
    return this.monitoramentoService.listAuditoria();
  }

  @RequirePermissions('dashboard.visualizar')
  @Get('alertas')
  getAlertas() {
    return this.monitoramentoService.getAlertasOperacionais();
  }
}
