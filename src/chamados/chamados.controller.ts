import { Body, Controller, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user';
import { JwtPayload } from '../auth/jwt';
import { RequireAnyPermissions, RequirePermissions } from '../auth/permissions';
import { PermissionsGuard } from '../auth/permissions.guard';
import {
  ChamadoExecucaoCheckinDto,
  ChamadoExecucaoConcluirDto,
  ChamadoExecucaoEvidenciaDto,
  CreateChamadoDto,
  UpdateChamadoStatusDto,
  UpdateChamadoAtribuicaoDto,
  UpdateChamadoPlanejamentoDto,
} from './chamados.dto';
import { ChamadosService } from './chamados.service';

@UseGuards(AuthGuard, PermissionsGuard)
@Controller('chamados')
export class ChamadosController {
  constructor(private readonly chamadosService: ChamadosService) {}

  @RequirePermissions('chamados.gerenciar')
  @Get('programacao')
  listProgramacao(
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('equipeId') equipeId?: string,
  ) {
    return this.chamadosService.listProgramacao(from, to, equipeId);
  }

  @RequirePermissions('chamados.gerenciar')
  @Get('equipes/opcoes')
  listEquipes() {
    return this.chamadosService.listEquipesAtivas();
  }

  @RequireAnyPermissions('chamados.gerenciar', 'chamados.executar')
  @Get('equipes/execucao')
  listEquipesExecucao(@CurrentUser() user: JwtPayload) {
    return this.chamadosService.listEquipesParaExecucao(user);
  }

  @RequireAnyPermissions('chamados.gerenciar', 'chamados.executar')
  @Get('em-execucao')
  listEmExecucaoPorEquipe(@CurrentUser() user: JwtPayload) {
    return this.chamadosService.listEmExecucaoPorEquipe(user);
  }

  @RequirePermissions('chamados.gerenciar')
  @Get()
  list() {
    return this.chamadosService.listChamados();
  }

  @RequireAnyPermissions('chamados.gerenciar', 'chamados.executar')
  @Get(':id/execucao')
  getExecucao(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.chamadosService.getChamadoParaExecucao(id, user);
  }

  @RequireAnyPermissions('chamados.gerenciar', 'chamados.executar')
  @Post(':id/execucao/checkin')
  checkinExecucao(@Param('id') id: string, @Body() body: ChamadoExecucaoCheckinDto, @CurrentUser() user: JwtPayload) {
    return this.chamadosService.registrarCheckinExecucao(id, body, user);
  }

  @RequireAnyPermissions('chamados.gerenciar', 'chamados.executar')
  @Post(':id/execucao/evidencias')
  addEvidenciaExecucao(
    @Param('id') id: string,
    @Body() body: ChamadoExecucaoEvidenciaDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.chamadosService.adicionarEvidenciaExecucao(id, body, user);
  }

  @RequireAnyPermissions('chamados.gerenciar', 'chamados.executar')
  @Post(':id/execucao/concluir')
  concluirExecucao(@Param('id') id: string, @Body() body: ChamadoExecucaoConcluirDto, @CurrentUser() user: JwtPayload) {
    return this.chamadosService.concluirExecucao(id, body, user);
  }

  @RequirePermissions('chamados.gerenciar')
  @Get(':id')
  get(@Param('id') id: string) {
    return this.chamadosService.getChamado(id);
  }

  @RequirePermissions('chamados.gerenciar')
  @Post()
  create(@Body() body: CreateChamadoDto, @CurrentUser() user: JwtPayload) {
    return this.chamadosService.createChamado(body, user);
  }

  @RequirePermissions('chamados.gerenciar')
  @Put(':id/status')
  updateStatus(@Param('id') id: string, @Body() body: UpdateChamadoStatusDto, @CurrentUser() user: JwtPayload) {
    return this.chamadosService.updateStatus(id, body, user);
  }

  @RequirePermissions('chamados.gerenciar')
  @Put(':id/atribuicao')
  updateAtribuicao(@Param('id') id: string, @Body() body: UpdateChamadoAtribuicaoDto, @CurrentUser() user: JwtPayload) {
    return this.chamadosService.updateAtribuicao(id, body, user);
  }

  @RequirePermissions('chamados.gerenciar')
  @Put(':id/planejamento')
  updatePlanejamento(@Param('id') id: string, @Body() body: UpdateChamadoPlanejamentoDto, @CurrentUser() user: JwtPayload) {
    return this.chamadosService.updatePlanejamento(id, body, user);
  }
}
