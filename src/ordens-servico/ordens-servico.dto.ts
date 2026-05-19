import { IsEnum, IsOptional, IsString } from 'class-validator';
import { OrdemServicoStatus } from '@prisma/client';

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
