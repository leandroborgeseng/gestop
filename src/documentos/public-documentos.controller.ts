import { Controller, Get, Param, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ValidarDocumentoPublicoQueryDto } from './documentos.dto';
import { DocumentosService } from './documentos.service';

@Controller('public')
export class PublicDocumentosController {
  constructor(private readonly documentosService: DocumentosService) {}

  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Get('documentos/validar/:codigo')
  validar(@Param('codigo') codigo: string, @Query() query: ValidarDocumentoPublicoQueryDto) {
    const verificador = query.v || query.verificador || query.codigo || null;
    return this.documentosService.validarPublico(codigo, verificador);
  }
}
