import { Body, Controller, Get, Header, Param, Post, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user';
import { JwtPayload } from '../auth/jwt';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequireAnyPermissions } from '../auth/permissions';
import { adminTabPermissionKeys } from '../domain/admin-permissions';
import { OPERACIONAL_READ_KEYS } from '../operacional/operacional.permissions';
import { WebmapCamadasService } from './webmap-camadas.service';

/** 296 — Administração › Importação › "Importar apenas camadas Webmap". Mesmas permissões da tela. */
@UseGuards(AuthGuard, PermissionsGuard)
@Controller('admin/importacao/webmap-camadas')
export class WebmapCamadasAdminController {
  constructor(private readonly service: WebmapCamadasService) {}

  @RequireAnyPermissions(...adminTabPermissionKeys('importacao', 'executar'))
  @Post('simular')
  simular(@CurrentUser() user: JwtPayload) {
    return this.service.simular(user);
  }

  @RequireAnyPermissions(...adminTabPermissionKeys('importacao', 'executar'))
  @Post('aplicar')
  aplicar(@Body() body: { simulacaoId?: string }, @CurrentUser() user: JwtPayload) {
    return this.service.aplicar(user, body?.simulacaoId);
  }

  @RequireAnyPermissions(...adminTabPermissionKeys('importacao', 'executar'))
  @Get('erros.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="erros-camadas-webmap.csv"')
  errosCsv(@Query('simulacaoId') simulacaoId: string) {
    return '\uFEFF' + this.service.errosCsv(simulacaoId);
  }

  @RequireAnyPermissions(...adminTabPermissionKeys('importacao', 'visualizar'))
  @Get('status')
  status() {
    return this.service.status();
  }

  @RequireAnyPermissions(...adminTabPermissionKeys('importacao', 'visualizar'))
  @Get('historico')
  historico(@Query('limit') limit?: string) {
    return this.service.historico(limit ? Number(limit) : 20);
  }
}

/** Leitura das camadas para o mapa (usuários do CCO). */
@UseGuards(AuthGuard, PermissionsGuard)
@RequireAnyPermissions(...OPERACIONAL_READ_KEYS)
@Controller('mapa/camadas')
export class WebmapCamadasMapaController {
  constructor(private readonly service: WebmapCamadasService) {}

  @Get()
  arvore() {
    return this.service.arvore();
  }

  @Get(':id/geojson')
  geojson(@Param('id') id: string, @Query('bbox') bbox?: string, @Query('zoom') zoom?: string) {
    return this.service.geojson(id, bbox, zoom);
  }
}
