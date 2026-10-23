import { CronogramaFrequencia } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class CronogramaDto {
  @IsString()
  unidadeId!: string;

  @IsString()
  checklistId!: string;

  @IsEnum(CronogramaFrequencia)
  frequencia!: CronogramaFrequencia;

  @IsDateString()
  proximaChecagemEm!: string;

  /** Legado: responsável único. Preferir `responsavelIds`. */
  @IsOptional()
  @IsString()
  responsavelId?: string;

  /** Responsáveis previstos (acompanhamento). Não restringe quem pode executar a vistoria. */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Type(() => String)
  responsavelIds?: string[];

  @IsOptional()
  @IsBoolean()
  ativo?: boolean;

  /**
   * 307/ajuste 1: o usuário confirmou "manter os responsáveis destacados" (após troca de Secretaria).
   * Gera um registro de auditoria com quem confirmou, o cronograma e os responsáveis mantidos.
   */
  @IsOptional()
  @IsBoolean()
  confirmarResponsaveisForaEscopo?: boolean;

  @IsOptional()
  @IsString()
  @MinLength(0)
  observacoes?: string;
}

export class CalendarioQueryDto {
  @IsDateString()
  from!: string;

  @IsDateString()
  to!: string;

  /** Ajuste 1: aceita lista (R3); validado/normalizado em `resolveFiltroSecretaria`. */
  @IsOptional()
  secretariaId?: string | string[];

  @IsOptional()
  @IsString()
  unidadeId?: string;
}
