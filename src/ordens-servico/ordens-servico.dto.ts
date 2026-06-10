import { IsDateString, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { OrdemServicoPrioridade, OrdemServicoStatus } from '@prisma/client';

export class CreateOrdemServicoDto {
  @IsString()
  unidadeId!: string;

  @IsString()
  @MinLength(5)
  titulo!: string;

  @IsString()
  @MinLength(10)
  descricao!: string;

  @IsOptional()
  @IsEnum(OrdemServicoPrioridade)
  prioridade?: OrdemServicoPrioridade;

  @IsOptional()
  @IsDateString()
  prazoEm?: string;
}

export class UpdateOrdemServicoDto {
  @IsEnum(OrdemServicoStatus)
  status!: OrdemServicoStatus;

  @IsOptional()
  @IsString()
  responsavelId?: string;

  @IsOptional()
  @IsString()
  motivo?: string;

  @IsOptional()
  @IsString()
  impedimentoMotivo?: string;
}
