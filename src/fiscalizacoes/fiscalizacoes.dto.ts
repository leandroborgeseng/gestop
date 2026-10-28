import { FiscalizacaoStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class ListFiscalizacoesQueryDto {
  @IsOptional()
  @IsString()
  secretariaId?: string;

  @IsOptional()
  @IsString()
  unidadeId?: string;

  @IsOptional()
  @IsString()
  agenteId?: string;

  @IsOptional()
  @IsString()
  tipo?: string;

  @IsOptional()
  @IsEnum(FiscalizacaoStatus)
  status?: FiscalizacaoStatus;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @IsString()
  q?: string;

  /** 304/O6a: `true` = só as enviadas como avulsa por conflito de programação; `false` = exclui. */
  @IsOptional()
  @IsIn(['true', 'false'])
  avulsaPorConflito?: 'true' | 'false';

  /** 305/E4: `true` = inclui as excluídas (exige a subfunção Visualizar excluídas). */
  @IsOptional()
  @IsIn(['true', 'false'])
  incluirExcluidas?: 'true' | 'false';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;
}

/** 305/E1: motivo obrigatório da exclusão lógica (o service valida e responde 400). */
export class ExcluirFiscalizacaoDto {
  @IsOptional()
  @IsString()
  motivo?: string;
}

export {
  ImprimirVistoriaManualDto,
  LancamentoManualFiscalizacaoDto,
} from './fiscalizacoes-manual.dto';
