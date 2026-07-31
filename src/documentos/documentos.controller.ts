import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Patch,
  Post,
  Query,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user';
import { JwtPayload } from '../auth/jwt';
import { RequireAnyPermissions } from '../auth/permissions';
import { PermissionsGuard } from '../auth/permissions.guard';
import {
  CancelarDocumentoDto,
  ColetarAssinaturaDto,
  CreateDocumentoAvulsoDto,
  ListDocumentosQueryDto,
  SalvarDocumentoRespostasDto,
  UpdateDocumentoVinculosDto,
} from './documentos.dto';
import { DocumentosService } from './documentos.service';

@Controller('documentos')
@UseGuards(AuthGuard, PermissionsGuard)
export class DocumentosController {
  constructor(private readonly documentosService: DocumentosService) {}

  @Get()
  @RequireAnyPermissions(
    'documentos.visualizar',
    'documentos.administrar',
    'dashboard.visualizar',
    'chamados.gerenciar',
    'fiscalizacoes.executar',
  )
  list(@Query() query: ListDocumentosQueryDto, @CurrentUser() user: JwtPayload) {
    return this.documentosService.list(query, user);
  }

  @Get('checklists-avulso')
  @RequireAnyPermissions(
    'documentos.visualizar',
    'documentos.criar_avulso',
    'documentos.administrar',
    'dashboard.visualizar',
  )
  listChecklistsAvulso(@CurrentUser() user: JwtPayload) {
    return this.documentosService.listChecklistsAvulso(user);
  }

  @Get('por-chamado/:chamadoId')
  @RequireAnyPermissions(
    'documentos.visualizar',
    'documentos.administrar',
    'dashboard.visualizar',
    'chamados.gerenciar',
    'fiscalizacoes.executar',
  )
  listByChamado(@Param('chamadoId') chamadoId: string, @CurrentUser() user: JwtPayload) {
    return this.documentosService.listByChamado(chamadoId, user);
  }

  @Get('por-fiscalizacao/:fiscalizacaoId')
  @RequireAnyPermissions(
    'documentos.visualizar',
    'documentos.administrar',
    'dashboard.visualizar',
    'chamados.gerenciar',
    'fiscalizacoes.executar',
  )
  listByFiscalizacao(
    @Param('fiscalizacaoId') fiscalizacaoId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.documentosService.listByFiscalizacao(fiscalizacaoId, user);
  }

  @Get(':id')
  @RequireAnyPermissions(
    'documentos.visualizar',
    'documentos.administrar',
    'dashboard.visualizar',
    'chamados.gerenciar',
    'fiscalizacoes.executar',
  )
  getById(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.documentosService.getById(id, user);
  }

  @Get(':id/pdf/original')
  @RequireAnyPermissions(
    'documentos.visualizar',
    'documentos.gerar_pdf',
    'documentos.administrar',
    'dashboard.visualizar',
    'chamados.gerenciar',
    'fiscalizacoes.executar',
  )
  @Header('Content-Type', 'application/pdf')
  async pdfOriginal(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    const { buffer, codigo } = await this.documentosService.getPdfBuffer(id, 'original', user);
    return new StreamableFile(buffer, {
      type: 'application/pdf',
      disposition: `inline; filename="${codigo}-original.pdf"`,
    });
  }

  @Get(':id/pdf/assinado')
  @RequireAnyPermissions(
    'documentos.visualizar',
    'documentos.gerar_pdf',
    'documentos.administrar',
    'dashboard.visualizar',
    'chamados.gerenciar',
    'fiscalizacoes.executar',
  )
  @Header('Content-Type', 'application/pdf')
  async pdfAssinado(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    const { buffer, codigo } = await this.documentosService.getPdfBuffer(id, 'assinado', user);
    return new StreamableFile(buffer, {
      type: 'application/pdf',
      disposition: `inline; filename="${codigo}-assinado.pdf"`,
    });
  }

  @Post('avulso')
  @RequireAnyPermissions('documentos.criar_avulso', 'documentos.administrar')
  createAvulso(@Body() body: CreateDocumentoAvulsoDto, @CurrentUser() user: JwtPayload) {
    return this.documentosService.createAvulso(body, user);
  }

  @Patch(':id/respostas')
  @RequireAnyPermissions(
    'documentos.criar_avulso',
    'documentos.gerar_pdf',
    'documentos.administrar',
  )
  salvarRespostas(
    @Param('id') id: string,
    @Body() body: SalvarDocumentoRespostasDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.documentosService.salvarRespostas(id, body, user);
  }

  @Post(':id/concluir')
  @RequireAnyPermissions(
    'documentos.criar_avulso',
    'documentos.gerar_pdf',
    'documentos.administrar',
  )
  concluir(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.documentosService.concluirDocumento(id, user);
  }

  @Post(':id/gerar-pdf')
  @RequireAnyPermissions('documentos.gerar_pdf', 'documentos.administrar', 'documentos.visualizar')
  gerarPdf(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.documentosService.gerarPdfOriginal(id, user);
  }

  @Patch(':id/vinculos')
  @RequireAnyPermissions('documentos.editar_vinculo', 'documentos.administrar')
  updateVinculos(
    @Param('id') id: string,
    @Body() body: UpdateDocumentoVinculosDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.documentosService.updateVinculos(id, body, user);
  }

  @Post(':id/assinatura')
  @RequireAnyPermissions('documentos.coletar_assinatura', 'documentos.administrar')
  coletarAssinatura(
    @Param('id') id: string,
    @Body() body: ColetarAssinaturaDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.documentosService.coletarAssinatura(id, body, user);
  }

  @Post(':id/assinatura-pendente')
  @RequireAnyPermissions('documentos.coletar_assinatura', 'documentos.administrar')
  marcarPendente(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.documentosService.marcarAssinaturaPendente(id, user);
  }

  @Post(':id/cancelar-assinado')
  @RequireAnyPermissions('documentos.cancelar_assinado', 'documentos.administrar')
  cancelarAssinado(
    @Param('id') id: string,
    @Body() body: CancelarDocumentoDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.documentosService.cancelarAssinado(id, body, user);
  }
}
