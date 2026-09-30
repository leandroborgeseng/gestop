import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
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

  @Get('por-chamado/:chamadoId')
  porChamado(@Param('chamadoId', ParseUuidPipe) chamadoId: string, @CurrentUser() user: JwtPayload) {
    return this.tarefas.listByChamado(chamadoId, user);
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
