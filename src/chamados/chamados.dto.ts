import { ChamadoModoLocalizacao, ChamadoOrigem, ChamadoPrioridade, ChamadoStatus, EvidenciaTipo } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsDateString, IsEmail, IsEnum, IsNumber, IsOptional, IsString, IsUUID, MinLength, ValidateIf, ValidateNested } from 'class-validator';

export class CreateChamadoDto {
  @IsEnum(ChamadoModoLocalizacao)
  modoLocalizacao!: ChamadoModoLocalizacao;

  @IsOptional()
  @IsString()
  unidadeId?: string;

  @IsOptional()
  @IsString()
  secretariaId?: string;

  @IsOptional()
  @IsNumber()
  latitude?: number;

  @IsOptional()
  @IsNumber()
  longitude?: number;

  @IsOptional()
  @IsString()
  @MinLength(5)
  enderecoTexto?: string;

  @IsOptional()
  @IsString()
  enderecoBairro?: string;

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

  @IsOptional()
  @IsString()
  fotoDataUrl?: string;
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

export class UpdateChamadoPlanejamentoDto {
  @IsOptional()
  @IsDateString()
  previstaExecucaoEm?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null && value !== undefined && value !== '')
  @IsUUID()
  equipeId?: string | null;

  @IsOptional()
  @IsEnum(ChamadoPrioridade)
  prioridade?: ChamadoPrioridade;
}

export class UpdateChamadoTriagemDto {
  @IsOptional()
  @ValidateIf((_, value) => value !== null && value !== undefined && value !== '')
  @IsUUID()
  tipoChamadoId?: string | null;

  @IsOptional()
  @IsEnum(ChamadoPrioridade)
  prioridade?: ChamadoPrioridade;
}

class ChamadoHistoricoAnexoDto {
  @IsString()
  dataUrl!: string;

  @IsOptional()
  @IsString()
  mimeType?: string;

  @IsOptional()
  @IsString()
  nome?: string;
}

export class RegistrarChamadoHistoricoDto {
  @IsString()
  @MinLength(3)
  descricao!: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChamadoHistoricoAnexoDto)
  anexos?: ChamadoHistoricoAnexoDto[];
}

export class EmitirOrdensServicoDto {
  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  ids?: string[];

  @IsOptional()
  @IsString()
  programacaoFrom?: string;

  @IsOptional()
  @IsString()
  programacaoTo?: string;

  @IsOptional()
  @IsString()
  equipeId?: string;

  @IsOptional()
  @IsBoolean()
  hoje?: boolean;
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
