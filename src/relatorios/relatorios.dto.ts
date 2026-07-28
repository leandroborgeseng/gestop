import { IsBooleanString, IsDateString, IsEnum, IsIn, IsOptional, IsString, IsUUID } from 'class-validator';
import { CronogramaFrequencia } from '@prisma/client';

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

  @IsOptional()
  @IsString()
  tipo?: string;

  @IsOptional()
  @IsString()
  unidadeId?: string;

  @IsOptional()
  @IsString()
  checklistId?: string;

  @IsOptional()
  @IsEnum(CronogramaFrequencia)
  frequencia?: CronogramaFrequencia;

  @IsOptional()
  @IsBooleanString()
  cronogramaAtivo?: string;

  @IsOptional()
  @IsString()
  responsavelId?: string;
}
