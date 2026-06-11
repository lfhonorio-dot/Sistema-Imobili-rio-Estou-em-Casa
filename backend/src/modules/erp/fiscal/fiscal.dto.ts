// DTOs do Módulo Fiscal (NFS-e, DIMOB, IRRF, Carnê-Leão)
import {
  IsString, IsOptional, IsEnum, IsNumber, IsBoolean, IsInt, Min, Max,
} from 'class-validator';
import { Type } from 'class-transformer';

export class SaveTaxConfigDto {
  @IsOptional() @IsEnum(['SIMPLES','LUCRO_PRESUMIDO','LUCRO_REAL','MEI']) regime?: string;
  @IsOptional() @IsString() cnpj?: string;
  @IsOptional() @IsString() inscricaoMunicipal?: string;
  @IsOptional() @IsString() municipio?: string;
  @IsOptional() @IsNumber() aliquotaISS?: number;
  @IsOptional() @IsNumber() aliquotaPIS?: number;
  @IsOptional() @IsNumber() aliquotaCOFINS?: number;
  @IsOptional() @IsString() nfseProvider?: string;
  @IsOptional() @IsEnum(['HOMOLOG','PRODUCTION']) nfseEnvironment?: string;
}

// Alias for backward compat
export class CreateTaxConfigDto extends SaveTaxConfigDto {}

export class EmitNfseDto {
  @IsOptional() @IsString() financialEntryId?: string;
  @IsString() issuerCnpj!: string;
  @IsString() takerDocument!: string;
  @IsString() takerName!: string;
  @IsString() serviceCode!: string;
  @IsString() description!: string;
  @IsNumber() amount!: number;
  @IsOptional() @IsNumber() issRate?: number;
  @IsOptional() @IsBoolean() issRetained?: boolean;
  @IsOptional() @IsString() competence?: string; // YYYY-MM
}

export class DimobQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(2020) year?: number;
}

export class IrrfQueryDto {
  @IsOptional() @IsString() period?: string; // YYYY-MM
}

export class CarneLeaoQueryDto {
  @IsOptional() @IsString() period?: string; // YYYY-MM
}

export class GenerateDimobDto {
  @IsInt() @Min(2020) year!: number;
}

export class GenerateCarneLeaoDto {
  @IsString() period!: string; // YYYY-MM
  @IsString() ownerDocument!: string;
  @IsString() ownerName!: string;
}
