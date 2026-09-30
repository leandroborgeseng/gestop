import { ChamadoPrioridade, ChamadoTarefaStatus } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

export class CreateChamadoTarefaDto {
  @IsUUID()
  chamadoId!: string;

  @IsString()
  @MinLength(3)
  titulo!: string;

  @IsOptional()
  @IsString()
  descricao?: string;

  @IsOptional()
  @IsDateString()
  prazo?: string;

  @IsUUID()
  secretariaId!: string;

  @IsOptional()
  @IsUUID()
  equipeId?: string;

  @IsOptional()
  @IsUUID()
  responsavelId?: string;

  @IsOptional()
  @IsEnum(ChamadoPrioridade)
  prioridade?: ChamadoPrioridade;
}

export class UpdateChamadoTarefaDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  titulo?: string;

  @IsOptional()
  @IsString()
  descricao?: string;

  @IsOptional()
  @IsDateString()
  prazo?: string | null;

  @IsOptional()
  @IsUUID()
  secretariaId?: string;

  @IsOptional()
  @IsUUID()
  equipeId?: string | null;

  @IsOptional()
  @IsUUID()
  responsavelId?: string | null;

  @IsOptional()
  @IsEnum(ChamadoPrioridade)
  prioridade?: ChamadoPrioridade;

  @IsOptional()
  @IsEnum(ChamadoTarefaStatus)
  status?: ChamadoTarefaStatus;

  @IsOptional()
  @IsString()
  justificativa?: string;

  @IsOptional()
  @IsString()
  conclusaoTexto?: string;

  @IsOptional()
  @IsString()
  observacao?: string;
}

export class AnexoChamadoTarefaDto {
  @IsString()
  @MinLength(20)
  dataUrl!: string;

  @IsOptional()
  @IsString()
  nome?: string;
}
