import { Controller, Get, Header, Query, StreamableFile, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { RequirePermissions } from '../auth/permissions';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RelatorioFiltroDto } from './relatorios.dto';
import { RelatoriosService } from './relatorios.service';

@UseGuards(AuthGuard, PermissionsGuard)
@RequirePermissions('dashboard.visualizar')
@Controller('relatorios')
export class RelatoriosController {
  constructor(private readonly relatoriosService: RelatoriosService) {}

  @Get('export/unidades.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="gestop-unidades.csv"')
  exportUnidades(@Query('secretariaId') secretariaId?: string) {
    return this.relatoriosService.unidadesCsv(secretariaId);
  }

  @Get('export/chamados.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="gestop-chamados.csv"')
  exportChamados(@Query() filtro: RelatorioFiltroDto) {
    return this.relatoriosService.chamadosCsv(filtro);
  }

  @Get('export/ordens-servico.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="gestop-ordens-servico.csv"')
  exportOrdensServico(@Query() filtro: RelatorioFiltroDto) {
    return this.relatoriosService.ordensServicoCsv(filtro);
  }

  @Get('export/fiscalizacoes.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="gestop-fiscalizacoes.csv"')
  exportFiscalizacoes(@Query() filtro: RelatorioFiltroDto) {
    return this.relatoriosService.fiscalizacoesCsv(filtro);
  }

  @Get('export/unidades.pdf')
  async exportUnidadesPdf(@Query('secretariaId') secretariaId?: string) {
    const buffer = await this.relatoriosService.unidadesPdf(secretariaId);
    return new StreamableFile(buffer, {
      type: 'application/pdf',
      disposition: 'attachment; filename="gestop-unidades.pdf"',
    });
  }

  @Get('export/chamados.pdf')
  async exportChamadosPdf(@Query() filtro: RelatorioFiltroDto) {
    const buffer = await this.relatoriosService.chamadosPdf(filtro);
    return new StreamableFile(buffer, {
      type: 'application/pdf',
      disposition: 'attachment; filename="gestop-chamados.pdf"',
    });
  }

  @Get('export/ordens-servico.pdf')
  async exportOrdensServicoPdf(@Query() filtro: RelatorioFiltroDto) {
    const buffer = await this.relatoriosService.ordensServicoPdf(filtro);
    return new StreamableFile(buffer, {
      type: 'application/pdf',
      disposition: 'attachment; filename="gestop-ordens-servico.pdf"',
    });
  }

  @Get('export/fiscalizacoes.pdf')
  async exportFiscalizacoesPdf(@Query() filtro: RelatorioFiltroDto) {
    const buffer = await this.relatoriosService.fiscalizacoesPdf(filtro);
    return new StreamableFile(buffer, {
      type: 'application/pdf',
      disposition: 'attachment; filename="gestop-fiscalizacoes.pdf"',
    });
  }
}
