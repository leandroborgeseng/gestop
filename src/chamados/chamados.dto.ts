import { ChamadoOrigem, ChamadoPrioridade, ChamadoStatus, EvidenciaTipo } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  MinLength,
  ValidateNested,
} from 'class-validator';

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

class ChamadoExecucaoGeoDto {
  @IsNumber()
  latitude!: number;

  @IsNumber()
  longitude!: number;

  @IsNumber()
  precisaoMetros!: number;
}

export class ChamadoExecucaoCheckinDto {
  @ValidateNested()
  @Type(() => ChamadoExecucaoGeoDto)
  checkin!: ChamadoExecucaoGeoDto;
}

export class ChamadoExecucaoEvidenciaDto {
  @IsString()
  url!: string;

  @IsOptional()
  @IsString()
  mimeType?: string;

  @IsOptional()
  @IsString()
  descricao?: string;

  @IsDateString()
  capturadaEm!: string;

  @ValidateNested()
  @Type(() => ChamadoExecucaoGeoDto)
  localizacao!: ChamadoExecucaoGeoDto;

  @IsOptional()
  @IsEnum(EvidenciaTipo)
  tipo?: EvidenciaTipo;
}

export class ChamadoExecucaoConcluirDto {
  @IsString()
  @MinLength(10)
  relatorio!: string;

  @ValidateNested()
  @Type(() => ChamadoExecucaoGeoDto)
  checkin!: ChamadoExecucaoGeoDto;

  @IsOptional()
  @IsBoolean()
  impedimento?: boolean;

  @IsOptional()
  @IsString()
  @MinLength(5)
  impedimentoMotivo?: string;
}
