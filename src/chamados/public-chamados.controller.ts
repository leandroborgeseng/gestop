import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { PublicCreateChamadoDto } from './chamados.dto';
import { ChamadosService } from './chamados.service';

@Controller('public')
export class PublicChamadosController {
  constructor(private readonly chamadosService: ChamadosService) {}

  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Get('unidades/:codigo')
  getUnidade(@Param('codigo') codigo: string) {
    return this.chamadosService.getUnidadePublicaByCodigo(codigo);
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('unidades/:codigo/chamados')
  createChamado(@Param('codigo') codigo: string, @Body() body: PublicCreateChamadoDto) {
    return this.chamadosService.createChamadoPublico(codigo, body);
  }
}
