import { FiscalizacaoStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class ListFiscalizacoesQueryDto {
  @IsOptional()
  @IsString()
  secretariaId?: string;

  @IsOptional()
  @IsString()
  unidadeId?: string;

  @IsOptional()
  @IsString()
  agenteId?: string;

  @IsOptional()
  @IsEnum(FiscalizacaoStatus)
  status?: FiscalizacaoStatus;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;
}
