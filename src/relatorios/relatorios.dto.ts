import { IsDateString, IsIn, IsOptional, IsString, IsUUID } from 'class-validator';

export class RelatorioFiltroDto {
  @IsOptional()
  @IsString()
  secretariaId?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsUUID()
  tipoChamadoId?: string;

  @IsOptional()
  @IsIn(['BAIXA', 'MEDIA', 'ALTA', 'URGENTE'])
  prioridade?: string;

  /** ID da equipe ou `sem-equipe` para chamados sem atribuição. */
  @IsOptional()
  @IsString()
  equipeId?: string;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}
