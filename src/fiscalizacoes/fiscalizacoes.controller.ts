import { Controller, Get, Param, Query } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user';
import { JwtPayload } from '../auth/jwt';
import { RequireAnyPermissions } from '../auth/permissions';
import { ListFiscalizacoesQueryDto } from './fiscalizacoes.dto';
import { FiscalizacoesService } from './fiscalizacoes.service';

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
