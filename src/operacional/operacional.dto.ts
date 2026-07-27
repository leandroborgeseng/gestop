import { IsOptional, IsString, MinLength } from 'class-validator';

export class VincularChamadoNcDto {
  @IsString()
  chamadoId!: string;
}

export class BaixarNaoConformidadeDto {
  @IsString()
  @MinLength(3, { message: 'Informe a justificativa da baixa (mínimo 3 caracteres).' })
  motivo!: string;
}

export class BuscarChamadosVincularQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  tipoChamadoId?: string;
}
