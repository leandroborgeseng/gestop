import { IsArray, IsBoolean, IsEmail, IsEnum, IsNumber, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { EquipeTipo, RegiaoUnidade, UnidadeTipo } from '@prisma/client';
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH_NEW } from '../auth/password-policy';

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

  @IsOptional()
  @IsEnum(RegiaoUnidade)
  regiao?: RegiaoUnidade;
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

  @IsOptional()
  @IsEnum(EquipeTipo)
  tipo?: EquipeTipo;

  @IsEmail()
  emailEquipe!: string;

  @IsArray()
  @IsString({ each: true })
  usuarioIds!: string[];

  @IsOptional()
  @IsBoolean()
  ativo?: boolean;
}

export class TipoChamadoDto {
  @IsString()
  @MinLength(2)
  nome!: string;

  @IsOptional()
  @IsString()
  descricao?: string;

  @IsNumber()
  @Min(1)
  @Max(365)
  slaBaixaDias!: number;

  @IsNumber()
  @Min(1)
  @Max(365)
  slaMediaDias!: number;

  @IsNumber()
  @Min(1)
  @Max(365)
  slaAltaDias!: number;

  @IsNumber()
  @Min(1)
  @Max(365)
  slaUrgenteDias!: number;

  @IsOptional()
  @IsBoolean()
  exigeVistoriaPrevia?: boolean;

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
  @MinLength(PASSWORD_MIN_LENGTH_NEW)
  @MaxLength(PASSWORD_MAX_LENGTH)
  senha?: string;

  @IsArray()
  @IsString({ each: true })
  perfilIds!: string[];

  @IsOptional()
  @IsBoolean()
  ativo?: boolean;
}

export class PerfilDto {
  @IsString()
  @MinLength(2)
  nome!: string;

  @IsOptional()
  @IsString()
  descricao?: string;

  @IsArray()
  @IsString({ each: true })
  permissaoIds!: string[];

  @IsOptional()
  @IsBoolean()
  ativo?: boolean;
}

export class CategoriaVistoriaDto {
  @IsString()
  @MinLength(2)
  nome!: string;

  @IsOptional()
  @IsBoolean()
  ativo?: boolean;
}
