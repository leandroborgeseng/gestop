import { Transform } from 'class-transformer';
import { IsArray, IsDateString, IsIn, IsOptional, IsString, IsUUID } from 'class-validator';
import { normalizarSecretariaIds } from '../auth/secretaria-scope';

export class DashboardFiltroDto {
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  /** R3: sempre array (aceita `secretariaId=A`, repetido ou `secretariaId[]=A`). */
  @IsOptional()
  @Transform(({ value }) => normalizarSecretariaIds(value))
  @IsArray()
  @IsString({ each: true })
  secretariaId?: string[];

  @IsOptional()
  @Transform(({ value }) => normalizarSecretariaIds(value))
  @IsArray()
  @IsString({ each: true })
  'secretariaId[]'?: string[];

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
