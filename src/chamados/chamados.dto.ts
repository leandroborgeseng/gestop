import { ChamadoOrigem, ChamadoPrioridade, ChamadoStatus } from '@prisma/client';
import { IsEmail, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateChamadoDto {
  @IsString()
  unidadeId!: string;

  @IsString()
  @MinLength(10)
  descricao!: string;

  @IsOptional()
  @IsEnum(ChamadoPrioridade)
  prioridade?: ChamadoPrioridade;

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

  @IsOptional()
  @IsString()
  fotoDataUrl?: string;
}

export class UpdateChamadoStatusDto {
  @IsEnum(ChamadoStatus)
  status!: ChamadoStatus;

  @IsOptional()
  @IsString()
  motivo?: string;

  @IsOptional()
  @IsString()
  responsavelId?: string;

  @IsOptional()
  @IsString()
  impedimentoMotivo?: string;

  @IsOptional()
  @IsString()
  equipeId?: string;
}

export class UpdateChamadoAtribuicaoDto {
  @IsOptional()
  @IsString()
  equipeId?: string;

  @IsOptional()
  @IsString()
  responsavelId?: string;

  @IsOptional()
  @IsString()
  motivo?: string;
}
