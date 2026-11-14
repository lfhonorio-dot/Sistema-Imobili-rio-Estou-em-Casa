import { IsBoolean, IsDateString, IsIn, IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class NfseConfigDto {
  @IsOptional() @IsIn(['SIMPLES', 'LUCRO_PRESUMIDO', 'LUCRO_REAL', 'MEI']) regime?: string;
  @IsOptional() @IsString() @MaxLength(150) razaoSocial?: string;
  @IsOptional() @IsString() cnpj?: string;
  @IsOptional() @IsString() @MaxLength(30) inscricaoMunicipal?: string;
  @IsOptional() @IsString() @MaxLength(10) itemListaServico?: string;
  @IsOptional() @IsString() @MaxLength(30) codigoTributacaoMunicipio?: string;
  @IsOptional() @IsString() @MaxLength(10) cnae?: string;
  @IsOptional() @IsInt() @Min(1) @Max(7) exigibilidadeIss?: number;
  @IsOptional() @IsInt() @Min(1) @Max(6) regimeEspecialTributacao?: number;
  @IsOptional() @IsBoolean() optanteSimples?: boolean;
  @IsOptional() @IsBoolean() incentivoFiscal?: boolean;
  @IsOptional() @IsNumber() aliquotaISS?: number;
  @IsOptional() @IsNumber() aliquotaPIS?: number;
  @IsOptional() @IsNumber() aliquotaCOFINS?: number;
  @IsOptional() @IsNumber() aliquotaIRPJ?: number;
  @IsOptional() @IsNumber() aliquotaCSLL?: number;
  @IsOptional() @IsNumber() presumidoIRPJ?: number;
  @IsOptional() @IsNumber() presumidoCSLL?: number;
  @IsOptional() @IsBoolean() retentionsEnabled?: boolean;
  @IsOptional() @IsNumber() retIrPct?: number;
  @IsOptional() @IsNumber() retPisPct?: number;
  @IsOptional() @IsNumber() retCofinsPct?: number;
  @IsOptional() @IsNumber() retCsllPct?: number;
  @IsOptional() @IsNumber() retMinAmount?: number;
  @IsOptional() @IsBoolean() retainIssWhenPj?: boolean;
  @IsOptional() @IsBoolean() autoIssueOnReceipt?: boolean;
  @IsOptional() @IsString() @MaxLength(5) rpsSerie?: string;
  @IsOptional() @IsInt() rpsNextNumber?: number;
  @IsOptional() @IsIn(['HOMOLOG', 'PRODUCTION']) nfseEnvironment?: 'HOMOLOG' | 'PRODUCTION';
  @IsOptional() @IsString() @MaxLength(300) nfseWsUrlHomolog?: string;
  @IsOptional() @IsString() @MaxLength(300) nfseWsUrlProd?: string;
  @IsOptional() @IsString() @MaxLength(200) nfseSoapNamespace?: string;
}

export class CertificateDto {
  @IsString() password!: string;
}

export class AuthorizeProductionDto {
  @IsString() confirm!: string;
}

export class RequestNfseDto {
  @IsOptional() @IsNumber() @Min(0.01) amount?: number;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @IsOptional() @IsDateString() competence?: string;
}

export class CancelNfseDto {
  @IsString() @MaxLength(500) reason!: string;
  @IsIn(['1', '2', '4']) code!: string;
}

export class SendNfseEmailDto {
  @IsOptional() @IsString() to?: string;
}

export class NfseQueryDto {
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() from?: string;
  @IsOptional() @IsString() to?: string;
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsString() entryId?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(200) limit?: number;
}

export class ReportQueryDto {
  @IsString() month!: string;
}
