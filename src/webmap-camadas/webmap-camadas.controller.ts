import { Body, Controller, Get, Header, HttpCode, Param, Post, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user';
import { JwtPayload } from '../auth/jwt';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequireAnyPermissions } from '../auth/permissions';
import { adminTabPermissionKeys } from '../domain/admin-permissions';
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
  @HttpCode(202)
  aplicar(@Body() body: { simulacaoId?: string }, @CurrentUser() user: JwtPayload) {
    return this.service.aplicar(user, body?.simulacaoId);
  }

  @RequireAnyPermissions(...adminTabPermissionKeys('importacao', 'executar'))
  @Get('erros.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="erros-camadas-webmap.csv"')
  async errosCsv(@Query('simulacaoId') simulacaoId?: string) {
    return '\uFEFF' + (await this.service.errosCsv(simulacaoId));
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

/**
 * 300 (QA ciclo 2): EXATAMENTE a mesma checagem que libera a tela do CCO — frontend
 * `<RequirePermissions permissions={['dashboard.visualizar']}>` em app/(authenticated)/cco/page.tsx e
 * NAV_ITEMS.cco.permission. No backend, hasAnyPermission dá passe ao Administrador do Sistema e expande
 * matriz → legado (matriz.cco.* , matriz.dashboard.*, matriz.relatorios.*, matriz.vistorias.* e matriz.cronograma.*
 * derivam dashboard.visualizar). Quem abre o CCO vê as camadas; os demais recebem 403.
 */
export const WEBMAP_MAPA_KEYS = ['dashboard.visualizar'];

/** Leitura das camadas para o mapa (usuários do CCO). */
@UseGuards(AuthGuard, PermissionsGuard)
@RequireAnyPermissions(...WEBMAP_MAPA_KEYS)
@Controller('mapa/camadas')
export class WebmapCamadasMapaController {
  constructor(private readonly service: WebmapCamadasService) {}

  /** Sem a permissão de Importação: só "importação em andamento" (fase, quem e desde quando ficam no status do Admin). */
  @Get('status')
  status() {
    return this.service.statusPublico();
  }

  @Get()
  arvore() {
    return this.service.arvore();
  }

  @Get(':id/geojson')
  geojson(@Param('id') id: string, @Query('bbox') bbox?: string, @Query('zoom') zoom?: string, @Query('v') v?: string) {
    return this.service.geojson(id, bbox, zoom, v);
  }
}
