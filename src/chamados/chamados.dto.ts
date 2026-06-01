import { ChamadoOrigem, ChamadoStatus, OrdemServicoPrioridade } from '@prisma/client';
import { IsEmail, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateChamadoDto {
  @IsString()
  unidadeId!: string;

  @IsString()
  @MinLength(10)
  descricao!: string;

  @IsOptional()
  @IsEnum(OrdemServicoPrioridade)
  prioridade?: OrdemServicoPrioridade;

  @IsOptional()
  @IsEnum(ChamadoOrigem)
  origem?: ChamadoOrigem;

  @IsOptional()
  @IsString()
  solicitanteNome?: string;

  @IsOptional()
  @IsEmail()
  solicitanteEmail?: string;

  @IsOptional()
  @IsString()
  solicitanteTelefone?: string;
}

export class PublicCreateChamadoDto {
  @IsString()
  @MinLength(10)
  descricao!: string;

  @IsOptional()
  @IsString()
  solicitanteNome?: string;

  @IsOptional()
  @IsEmail()
  solicitanteEmail?: string;

  @IsOptional()
  @IsString()
  solicitanteTelefone?: string;
}

export class UpdateChamadoStatusDto {
  @IsEnum(ChamadoStatus)
  status!: ChamadoStatus;

  @IsOptional()
  @IsString()
  motivo?: string;
}
