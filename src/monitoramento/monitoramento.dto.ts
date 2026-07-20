import { IsDateString, IsIn, IsOptional, IsString, IsUUID } from 'class-validator';

export class DashboardFiltroDto {
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @IsString()
  secretariaId?: string;

  @IsOptional()
  @IsString()
  equipeId?: string;

  @IsOptional()
  @IsString()
  cargo?: string;

  @IsOptional()
  @IsUUID()
  tipoChamadoId?: string;

  @IsOptional()
  @IsIn(['BAIXA', 'MEDIA', 'ALTA', 'URGENTE'])
  prioridade?: string;

  @IsOptional()
  @IsString()
  status?: string;
}
