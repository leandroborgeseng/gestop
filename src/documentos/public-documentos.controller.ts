import { Controller, Get, Param, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  ValidarDocumentoPorCodigoQueryDto,
  ValidarDocumentoPublicoQueryDto,
} from './documentos.dto';
import { DocumentosService } from './documentos.service';

@Controller('public')
export class PublicDocumentosController {
  constructor(private readonly documentosService: DocumentosService) {}

  /** Digitação manual: código do documento + código verificador. */
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Get('documentos/validar-por-documento')
  validarPorDocumento(@Query() query: ValidarDocumentoPorCodigoQueryDto) {
    return this.documentosService.validarPublicoPorDocumento(query.codigo, query.v || query.verificador);
  }

  /** Link/QR: código de validação + código verificador. */
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Get('documentos/validar/:codigo')
  validar(@Param('codigo') codigo: string, @Query() query: ValidarDocumentoPublicoQueryDto) {
    const verificador = query.v || query.verificador || null;
    return this.documentosService.validarPublico(codigo, verificador);
  }
}
