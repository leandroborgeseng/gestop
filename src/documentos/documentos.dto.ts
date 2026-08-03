import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { ConformidadeStatus, DocumentoOrigem, DocumentoSituacao, DocumentoTipo } from '@prisma/client';

export class ListDocumentosQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsEnum(DocumentoTipo)
  tipo?: DocumentoTipo;

  @IsOptional()
  @IsEnum(DocumentoSituacao)
  situacao?: DocumentoSituacao;

  @IsOptional()
  @IsEnum(DocumentoOrigem)
  origem?: DocumentoOrigem;

  @IsOptional()
  @IsUUID()
  secretariaId?: string;

  @IsOptional()
  @IsUUID()
  unidadeId?: string;

  @IsOptional()
  @IsUUID()
  chamadoId?: string;

  @IsOptional()
  @IsUUID()
  fiscalizacaoId?: string;

  @IsOptional()
  @IsUUID()
  responsavelId?: string;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @IsString()
  assinatura?: string;

  @IsOptional()
  @IsString()
  avulso?: string;

  @IsOptional()
  @IsString()
  limit?: string;

  @IsOptional()
  @IsString()
  offset?: string;
}

export class DocumentoRespostaItemDto {
  @IsUUID()
  itemId!: string;

  @IsOptional()
  @IsEnum(ConformidadeStatus)
  conformidade?: ConformidadeStatus;

  @IsOptional()
  @IsBoolean()
  valorBooleano?: boolean | null;

  @IsOptional()
  @IsString()
  valorTexto?: string | null;

  @IsOptional()
  @IsNumber()
  valorNumero?: number | null;

  @IsOptional()
  @IsString()
  comentario?: string | null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  evidenciaDataUrls?: string[];
}

export class CreateDocumentoAvulsoDto {
  @IsEnum(DocumentoTipo)
  tipo!: DocumentoTipo;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  titulo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  descricao?: string;

  @IsUUID()
  secretariaId!: string;

  @IsUUID()
  checklistVersaoId!: string;

  @IsOptional()
  @IsUUID()
  unidadeId?: string;

  @IsOptional()
  @IsUUID()
  chamadoId?: string;

  @IsOptional()
  @IsUUID()
  fiscalizacaoId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  enderecoTexto?: string;

  @IsOptional()
  @IsNumber()
  latitude?: number;

  @IsOptional()
  @IsNumber()
  longitude?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DocumentoRespostaItemDto)
  respostas?: DocumentoRespostaItemDto[];

  @IsOptional()
  @IsBoolean()
  concluir?: boolean;
}

export class SalvarDocumentoRespostasDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DocumentoRespostaItemDto)
  respostas!: DocumentoRespostaItemDto[];

  @IsOptional()
  @IsBoolean()
  concluir?: boolean;
}

export class UpdateDocumentoVinculosDto {
  @IsOptional()
  @IsUUID()
  unidadeId?: string | null;

  @IsOptional()
  @IsUUID()
  chamadoId?: string | null;

  @IsOptional()
  @IsUUID()
  fiscalizacaoId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  enderecoTexto?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  justificativa?: string;
}

export class ColetarAssinaturaDto {
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  assinanteNome!: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  assinanteDocumento?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  assinanteEmail?: string;

  /** Quando true, permite gravar sem CPF. */
  @IsOptional()
  @IsBoolean()
  cpfNaoInformado?: boolean;

  /** Quando true, permite gravar sem e-mail. */
  @IsOptional()
  @IsBoolean()
  emailNaoInformado?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(400)
  justificativaIdentificacao?: string;

  @IsString()
  @MinLength(2)
  @MaxLength(80)
  qualificacao!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  qualificacaoOutro?: string;

  @IsString()
  assinaturaDataUrl!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  mimeType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  timezone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  dispositivo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  sessaoId?: string;

  @IsOptional()
  @IsNumber()
  latitude?: number;

  @IsOptional()
  @IsNumber()
  longitude?: number;

  @IsOptional()
  @IsNumber()
  precisaoMetros?: number;

  @IsOptional()
  @IsDateString()
  localizacaoEm?: string;
}

export class CancelarDocumentoDto {
  @IsString()
  @MinLength(5)
  @MaxLength(1000)
  motivo!: string;
}

export class ValidarDocumentoPublicoQueryDto {
  @IsOptional()
  @IsString()
  v?: string;

  @IsOptional()
  @IsString()
  verificador?: string;
}

export class ValidarDocumentoPorCodigoQueryDto {
  @IsString()
  @MinLength(6)
  @MaxLength(40)
  codigo!: string;

  @IsOptional()
  @IsString()
  v?: string;

  @IsOptional()
  @IsString()
  verificador?: string;
}
