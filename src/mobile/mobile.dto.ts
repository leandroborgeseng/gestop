import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
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

  /** 303/G3: horário da leitura do GPS (check-in). */
  @IsOptional()
  @IsDateString()
  capturadoEm?: string;
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

  /** Quando false, registra NC pendente sem abrir chamado automaticamente. Default: true. */
  @IsOptional()
  @IsBoolean()
  gerarChamado?: boolean;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MobileEvidenciaDto)
  evidencias!: MobileEvidenciaDto[];
}

/** 304/O6a: a vistoria vai como avulsa porque a programação deu conflito; guarda a referência e o motivo. */
export class MobileAvulsaConflitoDto {
  @IsString()
  @MaxLength(500)
  motivo!: string;

  @IsString()
  cronogramaId!: string;

  @IsDateString()
  dataProgramada!: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  codigo?: string;
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

  /** Check-in (início). Opcional: sem ele, o 309/C4a usa o primeiro horário do aparelho no pacote. */
  @IsOptional()
  @IsDateString()
  iniciadaEm?: string;

  @IsDateString()
  concluidaEm!: string;

  @ValidateNested()
  @Type(() => MobileGeoDto)
  checkin!: MobileGeoDto;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MobileRespostaDto)
  respostas!: MobileRespostaDto[];

  @IsOptional()
  @IsString()
  cronogramaId?: string;

  @IsOptional()
  @IsDateString()
  dataProgramada?: string;

  /** 304/O6: `cronogramaAtualizadoEm` da programação no pacote offline (detecta alteração no servidor). */
  @IsOptional()
  @IsDateString()
  programacaoAtualizadaEm?: string;

  /** 304/O6a: presente quando o agente escolheu "Enviar como vistoria avulsa" após um conflito (sem cronogramaId). */
  @IsOptional()
  @ValidateNested()
  @Type(() => MobileAvulsaConflitoDto)
  avulsaPorConflito?: MobileAvulsaConflitoDto;
}
