import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Post,
  Query,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user';
import { JwtPayload } from '../auth/jwt';
import { RequireAnyPermissions, RequirePermissions } from '../auth/permissions';
import { PermissionsGuard } from '../auth/permissions.guard';
import {
  ImprimirVistoriaManualDto,
  LancamentoManualFiscalizacaoDto,
  ListFiscalizacoesQueryDto,
} from './fiscalizacoes.dto';
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

  @Get('opcoes-manuais')
  @RequirePermissions('fiscalizacoes.executar')
  getOpcoesManuais(@CurrentUser() user: JwtPayload) {
    return this.fiscalizacoesService.getOpcoesManuais(user);
  }

  @Post('imprimir-manual')
  @RequirePermissions('fiscalizacoes.executar')
  @Header('Content-Type', 'application/pdf')
  @Header('Content-Disposition', 'attachment; filename="vistoria-manual.pdf"')
  async imprimirManual(@Body() body: ImprimirVistoriaManualDto, @CurrentUser() user: JwtPayload) {
    const pdf = await this.fiscalizacoesService.imprimirManual(body, user);
    return new StreamableFile(pdf, {
      type: 'application/pdf',
      disposition: 'attachment; filename="vistoria-manual.pdf"',
    });
  }

  @Post('lancamento-manual')
  @RequirePermissions('fiscalizacoes.executar')
  lancamentoManual(@Body() body: LancamentoManualFiscalizacaoDto, @CurrentUser() user: JwtPayload) {
    return this.fiscalizacoesService.lancamentoManual(body, user);
  }

  @Get(':id')
  @RequireAnyPermissions('fiscalizacoes.executar', 'dashboard.visualizar', 'chamados.gerenciar')
  getById(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.fiscalizacoesService.getById(id, user);
  }
}
