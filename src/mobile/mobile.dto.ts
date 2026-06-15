import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { ConformidadeStatus, EvidenciaTipo } from '@prisma/client';

class MobileGeoDto {
  @IsNumber()
  latitude!: number;

  @IsNumber()
  longitude!: number;

  @IsNumber()
  precisaoMetros!: number;
}

class MobileEvidenciaDto {
  @IsEnum(EvidenciaTipo)
  tipo!: EvidenciaTipo;

  @IsString()
  url!: string;

  @IsOptional()
  @IsString()
  mimeType?: string;

  @IsOptional()
  @IsNumber()
  tamanhoBytes?: number;

  @IsDateString()
  capturadaEm!: string;

  @ValidateNested()
  @Type(() => MobileGeoDto)
  localizacao!: MobileGeoDto;
}

class MobileRespostaDto {
  @IsString()
  itemId!: string;

  @IsEnum(ConformidadeStatus)
  conformidade!: ConformidadeStatus;

  @IsOptional()
  @IsBoolean()
  valorBooleano?: boolean;

  @IsOptional()
  @IsString()
  valorTexto?: string;

  @IsOptional()
  @IsNumber()
  valorNumero?: number;

  @IsOptional()
  @IsString()
  comentario?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MobileEvidenciaDto)
  evidencias!: MobileEvidenciaDto[];
}

export class MobileSyncFiscalizacaoDto {
  @IsString()
  clientEventId!: string;

  @IsString()
  deviceId!: string;

  @IsString()
  unidadeId!: string;

  @IsString()
  checklistVersaoId!: string;

  @IsDateString()
  iniciadaEm!: string;

  @IsDateString()
  concluidaEm!: string;

  @ValidateNested()
  @Type(() => MobileGeoDto)
  checkin!: MobileGeoDto;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MobileRespostaDto)
  respostas!: MobileRespostaDto[];
}
