import { Body, Controller, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user';
import { JwtPayload } from '../auth/jwt';
import { RequirePermissions } from '../auth/permissions';
import { PermissionsGuard } from '../auth/permissions.guard';
import { CreateChamadoDto, UpdateChamadoStatusDto } from './chamados.dto';
import { ChamadosService } from './chamados.service';

@UseGuards(AuthGuard, PermissionsGuard)
@RequirePermissions('chamados.gerenciar')
@Controller('chamados')
export class ChamadosController {
  constructor(private readonly chamadosService: ChamadosService) {}

  @Get()
  list() {
    return this.chamadosService.listChamados();
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.chamadosService.getChamado(id);
  }

  @Post()
  create(@Body() body: CreateChamadoDto, @CurrentUser() user: JwtPayload) {
    return this.chamadosService.createChamado(body, user);
  }

  @Put(':id/status')
  updateStatus(@Param('id') id: string, @Body() body: UpdateChamadoStatusDto, @CurrentUser() user: JwtPayload) {
    return this.chamadosService.updateStatus(id, body, user);
  }

  @Post(':id/converter-os')
  convertToOs(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.chamadosService.convertToOrdemServico(id, user);
  }
}
