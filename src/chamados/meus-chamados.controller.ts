import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user';
import { JwtPayload } from '../auth/jwt';
import { RequireAnyPermissions } from '../auth/permissions';
import { PermissionsGuard } from '../auth/permissions.guard';
import { ParseUuidPipe } from '../common/parse-uuid.pipe';
import { AddChamadoObservadorDto, UpdateChamadoObservadoresDto } from './chamados.dto';
import { ChamadosService } from './chamados.service';

@UseGuards(AuthGuard, PermissionsGuard)
@Controller('meus-chamados')
export class MeusChamadosController {
  constructor(private readonly chamadosService: ChamadosService) {}

  @RequireAnyPermissions('meus_chamados.visualizar', 'chamados.abrir', 'chamados.gerenciar')
  @Get('usuarios/opcoes')
  listUsuarios(@Query('search') search?: string) {
    return this.chamadosService.listUsuariosParaObservador(search);
  }

  @RequireAnyPermissions('meus_chamados.visualizar', 'chamados.abrir', 'chamados.gerenciar')
  @Get()
  list(
    @CurrentUser() user: JwtPayload,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('search') search?: string,
    @Query('status') status?: string,
  ) {
    return this.chamadosService.listMeusChamados(
      {
        limit: limit ? Number(limit) : undefined,
        offset: offset ? Number(offset) : undefined,
        search,
        status,
      },
      user,
    );
  }

  @RequireAnyPermissions('meus_chamados.visualizar', 'chamados.abrir', 'chamados.gerenciar')
  @Get(':id')
  get(@Param('id', ParseUuidPipe) id: string, @CurrentUser() user: JwtPayload) {
    return this.chamadosService.getMeuChamado(id, user);
  }

  @RequireAnyPermissions('meus_chamados.visualizar', 'chamados.abrir', 'chamados.gerenciar')
  @Put(':id/observadores')
  updateObservadores(
    @Param('id', ParseUuidPipe) id: string,
    @Body() body: UpdateChamadoObservadoresDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.chamadosService.updateObservadoresMeuChamado(id, body, user);
  }

  @RequireAnyPermissions('meus_chamados.visualizar', 'chamados.abrir', 'chamados.gerenciar')
  @Post(':id/observadores')
  addObservador(
    @Param('id', ParseUuidPipe) id: string,
    @Body() body: AddChamadoObservadorDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.chamadosService.addObservadorMeuChamado(id, body.usuarioId, user);
  }

  @RequireAnyPermissions('meus_chamados.visualizar', 'chamados.abrir', 'chamados.gerenciar')
  @Delete(':id/observadores/:usuarioId')
  removeObservador(
    @Param('id', ParseUuidPipe) id: string,
    @Param('usuarioId', ParseUuidPipe) usuarioId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.chamadosService.removeObservadorMeuChamado(id, usuarioId, user);
  }
}
