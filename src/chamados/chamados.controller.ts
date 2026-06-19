import { Body, Controller, Delete, Get, Header, Param, Post, Put, Query, StreamableFile, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user';
import { JwtPayload } from '../auth/jwt';
import { RequireAnyPermissions, RequirePermissions } from '../auth/permissions';
import { PermissionsGuard } from '../auth/permissions.guard';
import { ParseUuidPipe } from '../common/parse-uuid.pipe';
import {
  ChamadoExecucaoCheckinDto,
  ChamadoExecucaoConcluirDto,
  ChamadoExecucaoEvidenciaDto,
  CreateChamadoDto,
  UpdateChamadoStatusDto,
  UpdateChamadoAtribuicaoDto,
  UpdateChamadoPlanejamentoDto,
  UpdateChamadoTriagemDto,
  UpdateChamadoAberturaDto,
  RegistrarChamadoHistoricoDto,
  EmitirOrdensServicoDto,
  ChamadoExecucaoManualDto,
} from './chamados.dto';
import { ChamadosService } from './chamados.service';

@UseGuards(AuthGuard, PermissionsGuard)
@Controller('chamados')
export class ChamadosController {
  constructor(private readonly chamadosService: ChamadosService) {}

  @RequirePermissions('chamados.gerenciar')
  @Get('tipos/opcoes')
  listTiposChamado() {
    return this.chamadosService.listTiposChamadoAtivos();
  }

  @RequirePermissions('chamados.gerenciar')
  @Post('ordens-servico/lote.pdf')
  @Header('Content-Type', 'application/pdf')
  @Header('Content-Disposition', 'attachment; filename="ordens-servico-lote.pdf"')
  async exportOrdensServicoLote(@Body() body: EmitirOrdensServicoDto, @CurrentUser() user: JwtPayload) {
    const pdf = await this.chamadosService.exportOrdensServicoLote(body, user);
    return new StreamableFile(pdf);
  }

  @RequirePermissions('chamados.gerenciar')
  @Get('programacao')
  listProgramacao(
    @Query('from') from: string,
    @Query('to') to: string,
    @CurrentUser() user: JwtPayload,
    @Query('equipeId') equipeId?: string,
  ) {
    return this.chamadosService.listProgramacao(from, to, user, equipeId);
  }

  @RequirePermissions('chamados.gerenciar')
  @Get('equipes/opcoes')
  listEquipes(@CurrentUser() user: JwtPayload) {
    return this.chamadosService.listEquipesAtivas(user);
  }

  @RequireAnyPermissions('chamados.gerenciar', 'chamados.executar')
  @Get('equipes/execucao')
  listEquipesExecucao(@CurrentUser() user: JwtPayload) {
    return this.chamadosService.listEquipesParaExecucao(user);
  }

  @RequireAnyPermissions('chamados.gerenciar', 'chamados.executar')
  @Get('em-execucao')
  listEmExecucaoPorEquipe(
    @CurrentUser() user: JwtPayload,
    @Query('programacaoFrom') programacaoFrom?: string,
    @Query('programacaoTo') programacaoTo?: string,
    @Query('hoje') hoje?: string,
  ) {
    return this.chamadosService.listEmExecucaoPorEquipe(user, {
      programacaoFrom,
      programacaoTo,
      hoje: hoje === 'true' || hoje === '1',
    });
  }

  @RequirePermissions('chamados.gerenciar')
  @Get()
  list(
    @CurrentUser() user: JwtPayload,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.chamadosService.listChamados(
      {
        limit: limit ? Number(limit) : undefined,
        offset: offset ? Number(offset) : undefined,
      },
      user,
    );
  }

  @RequireAnyPermissions('chamados.gerenciar', 'chamados.executar')
  @Get(':id/execucao')
  getExecucao(@Param('id', ParseUuidPipe) id: string, @CurrentUser() user: JwtPayload) {
    return this.chamadosService.getChamadoParaExecucao(id, user);
  }

  @RequireAnyPermissions('chamados.gerenciar', 'chamados.executar')
  @Post(':id/execucao/checkin')
  checkinExecucao(
    @Param('id', ParseUuidPipe) id: string,
    @Body() body: ChamadoExecucaoCheckinDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.chamadosService.registrarCheckinExecucao(id, body, user);
  }

  @RequireAnyPermissions('chamados.gerenciar', 'chamados.executar')
  @Post(':id/execucao/evidencias')
  addEvidenciaExecucao(
    @Param('id', ParseUuidPipe) id: string,
    @Body() body: ChamadoExecucaoEvidenciaDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.chamadosService.adicionarEvidenciaExecucao(id, body, user);
  }

  @RequireAnyPermissions('chamados.gerenciar', 'chamados.executar')
  @Delete(':id/execucao/evidencias/:evidenciaId')
  removeEvidenciaExecucao(
    @Param('id', ParseUuidPipe) id: string,
    @Param('evidenciaId', ParseUuidPipe) evidenciaId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.chamadosService.removerEvidenciaExecucao(id, evidenciaId, user);
  }

  @RequireAnyPermissions('chamados.gerenciar', 'chamados.executar')
  @Post(':id/execucao/concluir')
  concluirExecucao(
    @Param('id', ParseUuidPipe) id: string,
    @Body() body: ChamadoExecucaoConcluirDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.chamadosService.concluirExecucao(id, body, user);
  }

  @RequireAnyPermissions('chamados.gerenciar', 'chamados.executar', 'chamados.execucao_manual')
  @Post(':id/execucao/manual')
  registrarExecucaoManual(
    @Param('id', ParseUuidPipe) id: string,
    @Body() body: ChamadoExecucaoManualDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.chamadosService.registrarExecucaoManual(id, body, user);
  }

  @RequirePermissions('chamados.gerenciar')
  @Get(':id')
  get(@Param('id', ParseUuidPipe) id: string, @CurrentUser() user: JwtPayload) {
    return this.chamadosService.getChamado(id, user);
  }

  @RequirePermissions('chamados.gerenciar')
  @Post()
  create(@Body() body: CreateChamadoDto, @CurrentUser() user: JwtPayload) {
    return this.chamadosService.createChamado(body, user);
  }

  @RequirePermissions('chamados.gerenciar')
  @Put(':id/status')
  updateStatus(
    @Param('id', ParseUuidPipe) id: string,
    @Body() body: UpdateChamadoStatusDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.chamadosService.updateStatus(id, body, user);
  }

  @RequirePermissions('chamados.gerenciar')
  @Put(':id/atribuicao')
  updateAtribuicao(
    @Param('id', ParseUuidPipe) id: string,
    @Body() body: UpdateChamadoAtribuicaoDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.chamadosService.updateAtribuicao(id, body, user);
  }

  @RequirePermissions('chamados.gerenciar')
  @Put(':id/planejamento')
  updatePlanejamento(
    @Param('id', ParseUuidPipe) id: string,
    @Body() body: UpdateChamadoPlanejamentoDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.chamadosService.updatePlanejamento(id, body, user);
  }

  @RequirePermissions('chamados.gerenciar')
  @Put(':id/triagem')
  updateTriagem(
    @Param('id', ParseUuidPipe) id: string,
    @Body() body: UpdateChamadoTriagemDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.chamadosService.updateTriagem(id, body, user);
  }

  @RequireAnyPermissions('chamados.gerenciar', 'chamados.editar_abertura')
  @Put(':id/abertura')
  updateAbertura(
    @Param('id', ParseUuidPipe) id: string,
    @Body() body: UpdateChamadoAberturaDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.chamadosService.updateAbertura(id, body, user);
  }

  @RequirePermissions('chamados.gerenciar')
  @Post(':id/historico')
  registrarHistorico(
    @Param('id', ParseUuidPipe) id: string,
    @Body() body: RegistrarChamadoHistoricoDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.chamadosService.registrarHistorico(id, body, user);
  }

  @RequirePermissions('chamados.gerenciar')
  @Post(':id/notificar-equipe')
  notificarEquipe(@Param('id', ParseUuidPipe) id: string, @CurrentUser() user: JwtPayload) {
    return this.chamadosService.notificarEquipe(id, user);
  }
}
