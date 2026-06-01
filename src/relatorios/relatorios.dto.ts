import { IsDateString, IsOptional, IsString } from 'class-validator';

export class RelatorioFiltroDto {
  @IsOptional()
  @IsString()
  secretariaId?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}
