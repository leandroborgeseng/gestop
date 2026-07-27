import { IsBoolean, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { Type } from 'class-transformer';

export class BackupS3ConfigDto {
  @IsBoolean()
  enabled!: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  bucket?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  region?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  accessKeyId?: string | null;

  /** Em branco / omitido mantém o secret já salvo. */
  @IsOptional()
  @IsString()
  @MaxLength(512)
  secretAccessKey?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  prefix?: string | null;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(23)
  dailyHour!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  keepDaily!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(104)
  keepWeekly!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(120)
  keepMonthly!: number;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  endpoint?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  timezone?: string | null;

  @IsOptional()
  @IsBoolean()
  forcePathStyle?: boolean;
}

export class BackupRestoreDto {
  @IsString()
  @MinLength(1)
  @MaxLength(1024)
  objectKey!: string;

  /** Confirmação forte: deve ser exatamente RESTAURAR */
  @IsString()
  confirmacao!: string;
}
