import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequireAnyPermissions } from '../auth/permissions';
import { JwtPayload } from '../auth/jwt';
import { CalendarioQueryDto, CronogramaDto } from './cronograma.dto';
import {
  CRONOGRAMA_ALTERAR_KEYS,
  CRONOGRAMA_CHECKLISTS_KEYS,
  CRONOGRAMA_EXCLUIR_KEYS,
  CRONOGRAMA_INSERIR_KEYS,
  CRONOGRAMA_VISUALIZAR_KEYS,
} from './cronograma.permissions';
import { CronogramaService } from './cronograma.service';

@UseGuards(AuthGuard, PermissionsGuard)
@Controller('cronograma')
export class CronogramaController {
  constructor(private readonly cronogramaService: CronogramaService) {}

  @RequireAnyPermissions(...CRONOGRAMA_VISUALIZAR_KEYS)
  @Get('calendario')
  getCalendario(
    @CurrentUser() user: JwtPayload,
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('secretariaId') secretariaId?: string,
    @Query('unidadeId') unidadeId?: string,
  ) {
    const query: CalendarioQueryDto = { from, to, secretariaId, unidadeId };
    return this.cronogramaService.getCalendario(query, user);
  }

  @RequireAnyPermissions(...CRONOGRAMA_CHECKLISTS_KEYS)
  @Get('checklists')
  listChecklists(@CurrentUser() user: JwtPayload) {
    return this.cronogramaService.listChecklistsParaCronograma(user);
  }

  @RequireAnyPermissions(...CRONOGRAMA_VISUALIZAR_KEYS)
  @Get()
  list(
    @CurrentUser() user: JwtPayload,
    @Query('secretariaId') secretariaId?: string,
    @Query('unidadeId') unidadeId?: string,
  ) {
    return this.cronogramaService.listCronogramas({ secretariaId, unidadeId }, user);
  }

  @RequireAnyPermissions(...CRONOGRAMA_INSERIR_KEYS)
  @Post()
  create(@Body() body: CronogramaDto, @CurrentUser() user: JwtPayload) {
    return this.cronogramaService.createCronograma(body, user);
  }

  @RequireAnyPermissions(...CRONOGRAMA_ALTERAR_KEYS)
  @Put(':id')
  update(@Param('id') id: string, @Body() body: CronogramaDto, @CurrentUser() user: JwtPayload) {
    return this.cronogramaService.updateCronograma(id, body, user);
  }

  @RequireAnyPermissions(...CRONOGRAMA_EXCLUIR_KEYS)
  @Delete(':id')
  deactivate(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.cronogramaService.deactivateCronograma(id, user);
  }
}
