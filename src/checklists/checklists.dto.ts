import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { ChecklistEscopo, ChecklistItemTipo, UnidadeTipo } from '@prisma/client';

export class ChecklistDto {
  @IsString()
  @MinLength(2)
  nome!: string;

  @IsOptional()
  @IsString()
  descricao?: string;

  @IsOptional()
  @IsIn(['VISTORIA', 'CHAMADO'])
  finalidade?: 'VISTORIA' | 'CHAMADO';

  @IsEnum(ChecklistEscopo)
  escopo!: ChecklistEscopo;

  @IsOptional()
  @IsString()
  secretariaId?: string;

  @IsOptional()
  @IsString()
  unidadeId?: string;

  @IsOptional()
  @IsEnum(UnidadeTipo)
  unidadeTipo?: UnidadeTipo;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tipoChamadoIds?: string[];

  @IsOptional()
  @IsBoolean()
  ativo?: boolean;
}

export class ChecklistItemDto {
  @IsInt()
  @Min(1)
  ordem!: number;

  @IsString()
  @MinLength(2)
  codigo!: string;

  @IsString()
  @MinLength(2)
  titulo!: string;

  @IsOptional()
  @IsString()
  descricao?: string | null;

  @IsEnum(ChecklistItemTipo)
  tipo!: ChecklistItemTipo;

  @IsBoolean()
  obrigatorio!: boolean;

  @IsBoolean()
  geraNaoConformidade!: boolean;

  @IsBoolean()
  exigeEvidencia!: boolean;

  @IsOptional()
  opcoes?: unknown;

  @IsOptional()
  @IsString()
  categoriaVistoriaId?: string | null;
}

export class ChecklistVersionDto {
  @IsOptional()
  estrutura?: unknown;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChecklistItemDto)
  itens!: ChecklistItemDto[];
}
