import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { UnidadeTipo } from '@prisma/client';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user';
import { JwtPayload } from '../auth/jwt';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../auth/permissions';
import { OperacionalService } from './operacional.service';
import { UnidadeListQuery, UnidadeSituacao } from './operacional.types';

@UseGuards(AuthGuard, PermissionsGuard)
@RequirePermissions('dashboard.visualizar')
@Controller('operacional')
export class OperacionalController {
  constructor(private readonly operacionalService: OperacionalService) {}

  @Get('resumo')
  getResumo(@CurrentUser() user: JwtPayload) {
    return this.operacionalService.getResumo(user);
  }

  @Get('secretarias')
  listSecretarias(@CurrentUser() user: JwtPayload) {
    return this.operacionalService.listSecretarias(user);
  }

  @Get('bairros')
  listBairros() {
    return this.operacionalService.listBairros();
  }

  @Get('opcoes-filtro')
  getOpcoesFiltro(@CurrentUser() user: JwtPayload) {
    return this.operacionalService.getOpcoesFiltro(user);
  }

  @Get('unidades')
  listUnidades(
    @CurrentUser() user: JwtPayload,
    @Query('search') search?: string,
    @Query('secretariaId') secretariaId?: string,
    @Query('tipo') tipo?: UnidadeTipo,
    @Query('situacao') situacao?: UnidadeSituacao,
    @Query('pendencias') pendencias?: string,
    @Query('bairro') bairro?: string,
    @Query('responsavel') responsavel?: string,
    @Query('responsavelEmail') responsavelEmail?: string,
  ) {
    const query: UnidadeListQuery = {
      search: normalizeText(search),
      secretariaId: normalizeText(secretariaId),
      tipo,
      situacao,
      bairro: normalizeText(bairro),
      pendencias: parseOptionalBoolean(pendencias),
      responsavel: normalizeText(responsavel),
      responsavelEmail: normalizeText(responsavelEmail)?.toLowerCase(),
    };

    return this.operacionalService.listUnidades(query, user);
  }

  @Get('unidades/:id')
  getUnidadeDetalhe(@Param('id') id: string) {
    return this.operacionalService.getUnidadeDetalhe(id);
  }
}

function normalizeText(value?: string) {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function parseOptionalBoolean(value?: string) {
  if (value === undefined) {
    return undefined;
  }

  return value === 'true' || value === '1' || value === 'sim';
}
