import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../auth/permissions';
import { JwtPayload } from '../auth/jwt';
import { CalendarioQueryDto, CronogramaDto } from './cronograma.dto';
import { CronogramaService } from './cronograma.service';

@UseGuards(AuthGuard, PermissionsGuard)
@Controller('cronograma')
export class CronogramaController {
  constructor(private readonly cronogramaService: CronogramaService) {}

  @RequirePermissions('dashboard.visualizar')
  @Get('calendario')
  getCalendario(
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('secretariaId') secretariaId?: string,
    @Query('unidadeId') unidadeId?: string,
  ) {
    const query: CalendarioQueryDto = { from, to, secretariaId, unidadeId };
    return this.cronogramaService.getCalendario(query);
  }

  @RequirePermissions('dashboard.visualizar')
  @Get()
  list(
    @Query('secretariaId') secretariaId?: string,
    @Query('unidadeId') unidadeId?: string,
  ) {
    return this.cronogramaService.listCronogramas({ secretariaId, unidadeId });
  }

  @RequirePermissions('checklists.gerenciar')
  @Post()
  create(@Body() body: CronogramaDto, @CurrentUser() user: JwtPayload) {
    return this.cronogramaService.createCronograma(body, user);
  }

  @RequirePermissions('checklists.gerenciar')
  @Put(':id')
  update(@Param('id') id: string, @Body() body: CronogramaDto, @CurrentUser() user: JwtPayload) {
    return this.cronogramaService.updateCronograma(id, body, user);
  }

  @RequirePermissions('checklists.gerenciar')
  @Delete(':id')
  deactivate(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.cronogramaService.deactivateCronograma(id, user);
  }
}
