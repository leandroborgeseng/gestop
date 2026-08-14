import { IsArray, IsBoolean, IsIn, IsOptional, IsString, MinLength } from 'class-validator';

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

  @IsOptional()
  @IsIn(['INTERNO', 'EXTERNO'])
  natureza?: 'INTERNO' | 'EXTERNO';
}

export class PerfilUpdateDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  nome?: string;

  @IsOptional()
  @IsString()
  descricao?: string | null;

  @IsOptional()
  @IsIn(['INTERNO', 'EXTERNO'])
  natureza?: 'INTERNO' | 'EXTERNO';
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
