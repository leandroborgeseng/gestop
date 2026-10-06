import { Body, Controller, Get, Header, Param, Patch, Post, Query, StreamableFile, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user';
import { JwtPayload } from '../auth/jwt';
import { PermissionsGuard } from '../auth/permissions.guard';
import { ParseUuidPipe } from '../common/parse-uuid.pipe';
import { AnexoChamadoTarefaDto, CreateChamadoTarefaDto, UpdateChamadoTarefaDto } from './chamado-tarefas.dto';
import { ChamadoTarefasService } from './chamado-tarefas.service';

@UseGuards(AuthGuard, PermissionsGuard)
@Controller('chamado-tarefas')
export class ChamadoTarefasController {
  constructor(private readonly tarefas: ChamadoTarefasService) {}

  @Get('opcoes')
  opcoes(@CurrentUser() user: JwtPayload, @Query('secretariaId') secretariaId?: string) {
    return this.tarefas.opcoes(user, secretariaId);
  }

  @Get('execucao')
  execucao(@CurrentUser() user: JwtPayload, @Query() query: Record<string, string | undefined>) {
    return this.tarefas.listExecucao(query, user);
  }

  @Get('relatorio')
  relatorio(@CurrentUser() user: JwtPayload, @Query() query: Record<string, string | undefined>) {
    return this.tarefas.relatorio(query, user);
  }

  @Get('relatorio.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="sigma-tarefas-chamados.csv"')
  exportCsv(@CurrentUser() user: JwtPayload, @Query() query: Record<string, string | undefined>) {
    return this.tarefas.exportarCsv(query, user);
  }

  @Get('relatorio.pdf')
  async exportPdf(@CurrentUser() user: JwtPayload, @Query() query: Record<string, string | undefined>) {
    const buffer = await this.tarefas.exportarPdf(query, user);
    const nome = query.capa === 'simples' ? 'sigma-tarefas-exibidas.pdf' : 'sigma-tarefas-chamados.pdf';
    return new StreamableFile(buffer, {
      type: 'application/pdf',
      disposition: `attachment; filename="${nome}"`,
      length: buffer.length,
    });
  }

  @Get('relatorio.xlsx')
  async exportXlsx(@CurrentUser() user: JwtPayload, @Query() query: Record<string, string | undefined>) {
    const buffer = await this.tarefas.exportarXlsx(query, user);
    return new StreamableFile(buffer, {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      disposition: 'attachment; filename="sigma-tarefas-chamados.xlsx"',
      length: buffer.length,
    });
  }

  @Get('por-chamado/:chamadoId')
  porChamado(@Param('chamadoId', ParseUuidPipe) chamadoId: string, @CurrentUser() user: JwtPayload) {
    return this.tarefas.listByChamado(chamadoId, user);
  }

  @Get(':id/chamado/:chamadoId')
  getChamadoLeitura(
    @Param('id', ParseUuidPipe) id: string,
    @Param('chamadoId', ParseUuidPipe) chamadoId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.tarefas.getChamadoLeituraViaTarefa(id, chamadoId, user);
  }

  @Get(':id')
  getById(@Param('id', ParseUuidPipe) id: string, @CurrentUser() user: JwtPayload) {
    return this.tarefas.getById(id, user);
  }

  @Post()
  create(@Body() body: CreateChamadoTarefaDto, @CurrentUser() user: JwtPayload) {
    return this.tarefas.create(body, user);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUuidPipe) id: string,
    @Body() body: UpdateChamadoTarefaDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.tarefas.update(id, body, user);
  }

  @Post(':id/anexos')
  anexar(
    @Param('id', ParseUuidPipe) id: string,
    @Body() body: AnexoChamadoTarefaDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.tarefas.anexar(id, body, user);
  }
}
