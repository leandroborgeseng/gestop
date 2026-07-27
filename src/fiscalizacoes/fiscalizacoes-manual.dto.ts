import { ConformidadeStatus, EvidenciaTipo } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class ImprimirVistoriaManualDto {
  @IsString()
  checklistVersaoId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  unidadeIds!: string[];

  @IsString()
  @MinLength(3)
  @MaxLength(2000)
  ondeEncaminharFotos!: string;
}

class LancamentoManualGeoDto {
  @IsOptional()
  @IsNumber()
  latitude?: number;

  @IsOptional()
  @IsNumber()
  longitude?: number;

  @IsOptional()
  @IsNumber()
  precisaoMetros?: number;
}

class LancamentoManualEvidenciaDto {
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

  @IsOptional()
  @ValidateNested()
  @Type(() => LancamentoManualGeoDto)
  localizacao?: LancamentoManualGeoDto;
}

class LancamentoManualRespostaDto {
  @IsString()
  itemId!: string;

  @IsEnum(ConformidadeStatus)
  conformidade!: ConformidadeStatus;

  @IsOptional()
  @IsBoolean()
  valorBooleano?: boolean | null;

  @IsOptional()
  @IsString()
  valorTexto?: string;

  @IsOptional()
  @IsNumber()
  valorNumero?: number;

  @IsOptional()
  @IsString()
  comentario?: string;

  /** Quando false, registra NC pendente sem abrir chamado automaticamente. Default: true. */
  @IsOptional()
  @IsBoolean()
  gerarChamado?: boolean;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LancamentoManualEvidenciaDto)
  evidencias!: LancamentoManualEvidenciaDto[];
}

export class LancamentoManualFiscalizacaoDto {
  @IsString()
  unidadeId!: string;

  @IsString()
  checklistVersaoId!: string;

  /** Data real da vistoria em campo (obrigatória). Aceita ISO date ou datetime. */
  @IsDateString()
  dataVistoria!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  observacoes?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => LancamentoManualRespostaDto)
  respostas!: LancamentoManualRespostaDto[];
}
