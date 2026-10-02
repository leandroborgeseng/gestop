import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Patch,
  Post,
  Query,
  Req,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user';
import { JwtPayload } from '../auth/jwt';
import { RequireAnyPermissions } from '../auth/permissions';
import { PermissionsGuard } from '../auth/permissions.guard';
import {
  AssinarDocumentoInternoDto,
  CancelarDocumentoDto,
  ColetarAssinaturaDto,
  CreateDocumentoAvulsoDto,
  DisponibilizarAssinaturaInternaDto,
  ListDocumentosQueryDto,
  RecusarAssinaturaInternaDto,
  SalvarDocumentoRespostasDto,
  UpdateDocumentoVinculosDto,
} from './documentos.dto';
import { DocumentosService } from './documentos.service';
import { DOCUMENTOS_MODULO_KEYS, DOCUMENTOS_RELACIONADOS_KEYS } from './documentos.permissions';

@Controller('documentos')
@UseGuards(AuthGuard, PermissionsGuard)
export class DocumentosController {
  constructor(private readonly documentosService: DocumentosService) {}

  @Get()
  @RequireAnyPermissions(...DOCUMENTOS_MODULO_KEYS)
  list(@Query() query: ListDocumentosQueryDto, @CurrentUser() user: JwtPayload) {
    return this.documentosService.list(query, user);
  }

  @Get('minhas-pendencias-assinatura')
  listMinhasPendencias(@CurrentUser() user: JwtPayload) {
    return this.documentosService.listMinhasPendenciasAssinatura(user);
  }

  @Get('pendencias-resumo')
  pendenciasResumo(@CurrentUser() user: JwtPayload) {
    return this.documentosService.pendenciasResumo(user);
  }

  @Get('signatarios-internos')
  @RequireAnyPermissions(
    'documentos.disponibilizar_assinatura',
    'documentos.administrar',
    'usuarios.gerenciar',
  )
  listSignatarios(@CurrentUser() user: JwtPayload, @Query('search') search?: string) {
    return this.documentosService.listSignatariosInternos(search, user);
  }

  @Get('chamados-busca')
  @RequireAnyPermissions(
    'documentos.visualizar',
    'documentos.criar_avulso',
    'documentos.editar_vinculo',
    'documentos.administrar',
  )
  buscarChamados(@CurrentUser() user: JwtPayload, @Query('q') q?: string) {
    return this.documentosService.buscarChamadosParaVinculo(q, user);
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
  @RequireAnyPermissions(...DOCUMENTOS_RELACIONADOS_KEYS)
  listByChamado(@Param('chamadoId') chamadoId: string, @CurrentUser() user: JwtPayload) {
    return this.documentosService.listByChamado(chamadoId, user);
  }

  @Get('por-fiscalizacao/:fiscalizacaoId')
  @RequireAnyPermissions(...DOCUMENTOS_RELACIONADOS_KEYS)
  listByFiscalizacao(
    @Param('fiscalizacaoId') fiscalizacaoId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.documentosService.listByFiscalizacao(fiscalizacaoId, user);
  }

  @Get(':id')
  getById(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.documentosService.getById(id, user);
  }

  @Get(':id/pdf/original')
  @Header('Content-Type', 'application/pdf')
  async pdfOriginal(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    const { buffer, codigo } = await this.documentosService.getPdfBuffer(id, 'original', user);
    return new StreamableFile(buffer, {
      type: 'application/pdf',
      disposition: `inline; filename="${codigo}-original.pdf"`,
    });
  }

  @Get(':id/pdf/assinado')
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

  @Post(':id/assinatura-interna')
  assinarInterno(
    @Param('id') id: string,
    @Body() body: AssinarDocumentoInternoDto,
    @CurrentUser() user: JwtPayload,
    @Req() req: { headers?: Record<string, string | string[] | undefined>; ip?: string; socket?: { remoteAddress?: string } },
  ) {
    const forwarded = req.headers?.['x-forwarded-for'];
    const forwardedValue = Array.isArray(forwarded) ? forwarded[0] : forwarded;
    const ip = forwardedValue?.split(',')[0]?.trim() || req.ip || req.socket?.remoteAddress || null;
    const agent = req.headers?.['user-agent'];
    const userAgent = Array.isArray(agent) ? agent[0] : agent ?? null;
    return this.documentosService.assinarInterno(id, body, user, { ip, userAgent });
  }

  @Post(':id/disponibilizar-assinatura')
  @RequireAnyPermissions(
    'documentos.disponibilizar_assinatura',
    'documentos.administrar',
    'usuarios.gerenciar',
  )
  disponibilizar(
    @Param('id') id: string,
    @Body() body: DisponibilizarAssinaturaInternaDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.documentosService.disponibilizarAssinaturaInterna(id, body, user);
  }

  @Post('pedidos-assinatura/:pedidoId/retirar')
  @RequireAnyPermissions(
    'documentos.disponibilizar_assinatura',
    'documentos.administrar',
    'usuarios.gerenciar',
  )
  retirarPedido(
    @Param('pedidoId') pedidoId: string,
    @Body() body: RecusarAssinaturaInternaDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.documentosService.retirarAssinaturaInterna(pedidoId, user, body?.motivo);
  }

  @Post('pedidos-assinatura/:pedidoId/recusar')
  recusarPedido(
    @Param('pedidoId') pedidoId: string,
    @Body() body: RecusarAssinaturaInternaDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.documentosService.recusarAssinaturaInterna(pedidoId, body, user);
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
  togglePendente(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.documentosService.toggleAssinaturaPendente(id, user);
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
