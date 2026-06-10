import { IsArray, IsBoolean, IsEmail, IsEnum, IsNumber, IsOptional, IsString, Min, MinLength } from 'class-validator';
import { UnidadeTipo } from '@prisma/client';

export class SecretariaDto {
  @IsString()
  @MinLength(2)
  nome!: string;

  @IsString()
  @MinLength(2)
  sigla!: string;

  @IsOptional()
  @IsString()
  descricao?: string;

  @IsOptional()
  @IsString()
  responsavelNome?: string;

  @IsOptional()
  @IsEmail()
  responsavelEmail?: string;

  @IsOptional()
  @IsBoolean()
  ativo?: boolean;
}

export class UnidadeDto {
  @IsString()
  secretariaId!: string;

  @IsString()
  @MinLength(3)
  codigoPatrimonial!: string;

  @IsString()
  @MinLength(2)
  nome!: string;

  @IsEnum(UnidadeTipo)
  tipo!: UnidadeTipo;

  @IsString()
  endereco!: string;

  @IsOptional()
  @IsString()
  bairro?: string;

  @IsOptional()
  @IsString()
  cep?: string;

  @IsNumber()
  latitude!: number;

  @IsNumber()
  longitude!: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  raioValidacaoMetros?: number;

  @IsOptional()
  @IsBoolean()
  ativo?: boolean;
}

export class EquipeDto {
  @IsOptional()
  @IsString()
  secretariaId?: string;

  @IsString()
  @MinLength(2)
  nome!: string;

  @IsOptional()
  @IsString()
  descricao?: string;

  @IsArray()
  @IsString({ each: true })
  usuarioIds!: string[];

  @IsOptional()
  @IsBoolean()
  ativo?: boolean;
}

export class UsuarioDto {
  @IsOptional()
  @IsString()
  secretariaId?: string;

  @IsString()
  @MinLength(2)
  nome!: string;

  @IsEmail()
  email!: string;

  @IsOptional()
  @IsString()
  cpf?: string;

  @IsOptional()
  @IsString()
  telefone?: string;

  @IsOptional()
  @IsString()
  cargo?: string;

  @IsOptional()
  @IsString()
  @MinLength(6)
  senha?: string;

  @IsArray()
  @IsString({ each: true })
  perfilIds!: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  equipeIds?: string[];

  @IsOptional()
  @IsBoolean()
  ativo?: boolean;
}
