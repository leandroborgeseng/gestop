import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user';
import { JwtPayload } from '../auth/jwt';
import { RequireAnyPermissions } from '../auth/permissions';
import { PermissionsGuard } from '../auth/permissions.guard';
import { ListFiscalizacoesQueryDto } from './fiscalizacoes.dto';
import { FiscalizacoesService } from './fiscalizacoes.service';

@UseGuards(AuthGuard, PermissionsGuard)
@Controller('fiscalizacoes')
export class FiscalizacoesController {
  constructor(private readonly fiscalizacoesService: FiscalizacoesService) {}

  @Get()
  @RequireAnyPermissions('fiscalizacoes.executar', 'dashboard.visualizar', 'chamados.gerenciar')
  list(@Query() query: ListFiscalizacoesQueryDto, @CurrentUser() user: JwtPayload) {
    return this.fiscalizacoesService.list(query, user);
  }

  @Get(':id')
  @RequireAnyPermissions('fiscalizacoes.executar', 'dashboard.visualizar', 'chamados.gerenciar')
  getById(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.fiscalizacoesService.getById(id, user);
  }
}
