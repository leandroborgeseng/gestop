import { IsBoolean, IsEmail, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class EmailConfigDto {
  @IsBoolean()
  ativo!: boolean;

  @IsOptional()
  @IsEmail()
  @MaxLength(180)
  remetenteEmail?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  remetenteNome?: string | null;

  @IsOptional()
  @IsEmail()
  @MaxLength(180)
  replyTo?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(180)
  smtpHost?: string | null;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65535)
  smtpPort!: number;

  @IsIn(['NENHUMA', 'SSL', 'TLS'])
  seguranca!: 'NENHUMA' | 'SSL' | 'TLS';

  @IsBoolean()
  usarAutenticacao!: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(180)
  usuario?: string | null;

  /** Em branco mantém a senha já salva. */
  @IsOptional()
  @IsString()
  @MaxLength(256)
  senha?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(180)
  assuntoEquipe?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  textoIntroEquipe?: string | null;
}

export class EmailTesteDto {
  @IsEmail()
  @MaxLength(180)
  destino!: string;
}
