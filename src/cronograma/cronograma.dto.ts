import { CronogramaFrequencia } from '@prisma/client';
import { IsBoolean, IsDateString, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';

export class CronogramaDto {
  @IsString()
  unidadeId!: string;

  @IsString()
  checklistId!: string;

  @IsEnum(CronogramaFrequencia)
  frequencia!: CronogramaFrequencia;

  @IsDateString()
  proximaChecagemEm!: string;

  @IsOptional()
  @IsString()
  responsavelId?: string;

  @IsOptional()
  @IsBoolean()
  ativo?: boolean;

  @IsOptional()
  @IsString()
  @MinLength(0)
  observacoes?: string;
}

export class CalendarioQueryDto {
  @IsDateString()
  from!: string;

  @IsDateString()
  to!: string;

  @IsOptional()
  @IsString()
  secretariaId?: string;

  @IsOptional()
  @IsString()
  unidadeId?: string;
}
