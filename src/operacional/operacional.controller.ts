import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { UnidadeTipo, RegiaoUnidade } from '@prisma/client';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user';
import { JwtPayload } from '../auth/jwt';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../auth/permissions';
import { OperacionalService } from './operacional.service';
import {
  ChamadosMapaQuery,
  SlaFiltro,
  TipoPendencia,
  UnidadeListQuery,
  UnidadeSituacao,
} from './operacional.types';

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

  @Get('chamados-mapa')
  listChamadosMapa(
    @CurrentUser() user: JwtPayload,
    @Query('search') search?: string,
    @Query('status') status?: string | string[],
    @Query('prioridade') prioridade?: string | string[],
    @Query('tipoChamadoId') tipoChamadoId?: string | string[],
    @Query('equipeIds') equipeIds?: string | string[],
    @Query('sla') sla?: SlaFiltro,
    @Query('bairro') bairro?: string,
    @Query('comUnidade') comUnidade?: 'TODOS' | 'COM' | 'SEM',
  ) {
    const query: ChamadosMapaQuery = {
      search: normalizeText(search),
      status: normalizeStringArray(status),
      prioridade: normalizeStringArray(prioridade),
      tipoChamadoId: normalizeStringArray(tipoChamadoId),
      equipeIds: normalizeStringArray(equipeIds),
      sla: normalizeSla(sla),
      bairro: normalizeText(bairro),
      comUnidade: comUnidade === 'COM' || comUnidade === 'SEM' ? comUnidade : undefined,
    };

    return this.operacionalService.listChamadosMapa(query, user);
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
    @Query('regiao') regiao?: RegiaoUnidade,
    @Query('responsavel') responsavel?: string,
    @Query('responsavelEmail') responsavelEmail?: string,
    @Query('tiposPendencia') tiposPendencia?: string | string[],
    @Query('tiposChamadoId') tiposChamadoId?: string | string[],
    @Query('equipeIds') equipeIds?: string | string[],
    @Query('sla') sla?: SlaFiltro,
  ) {
    const query: UnidadeListQuery = {
      search: normalizeText(search),
      secretariaId: normalizeText(secretariaId),
      tipo,
      situacao,
      bairro: normalizeText(bairro),
      regiao,
      pendencias: parseOptionalBoolean(pendencias),
      responsavel: normalizeText(responsavel),
      responsavelEmail: normalizeText(responsavelEmail)?.toLowerCase(),
      tiposPendencia: normalizeTiposPendencia(tiposPendencia),
      tiposChamadoId: normalizeStringArray(tiposChamadoId),
      equipeIds: normalizeStringArray(equipeIds),
      sla: normalizeSla(sla),
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

function normalizeStringArray(value?: string | string[]) {
  if (!value) return undefined;
  const items = (Array.isArray(value) ? value : value.split(','))
    .map((item) => item.trim())
    .filter(Boolean);
  return items.length > 0 ? items : undefined;
}

function normalizeTiposPendencia(value?: string | string[]): TipoPendencia[] | undefined {
  const items = normalizeStringArray(value);
  if (!items) return undefined;
  const allowed: TipoPendencia[] = ['CHAMADOS', 'NAO_CONFORMIDADES', 'VISTORIAS'];
  const filtered = items.filter((item): item is TipoPendencia =>
    allowed.includes(item as TipoPendencia),
  );
  return filtered.length > 0 ? filtered : undefined;
}

function normalizeSla(value?: string): SlaFiltro | undefined {
  if (value === 'DENTRO' || value === 'FORA') return value;
  return undefined;
}
