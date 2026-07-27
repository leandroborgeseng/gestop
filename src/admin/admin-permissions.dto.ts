import { IsArray, IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';

export class PerfilCreateDto {
  @IsString()
  @MinLength(2)
  nome!: string;

  @IsOptional()
  @IsString()
  descricao?: string;

  @IsOptional()
  @IsBoolean()
  ativo?: boolean;
}

export class PerfilUpdateDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  nome?: string;

  @IsOptional()
  @IsString()
  descricao?: string | null;
}

export class PerfilAtivoDto {
  @IsBoolean()
  ativo!: boolean;
}

export class PerfilMatrizDto {
  @IsArray()
  @IsString({ each: true })
  chaves!: string[];
}
