// DTOs do Módulo de Cobranças (Boletos, CNAB, Gateways)
import {
  IsString, IsOptional, IsEnum, IsNumber, IsBoolean,
  IsDateString, IsInt, Min, Max, IsPositive,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateGatewayConfigDto {
  @IsEnum(['ASAAS','EFI','PAGARME','ZOOP','ITAU','BRADESCO','BB']) provider!: string;
  @IsString() name!: string;
  @IsString() apiKey!: string;
  @IsOptional() @IsString() apiSecret?: string;
  @IsOptional() @IsString() webhookSecret?: string;
  @IsEnum(['SANDBOX','PRODUCTION']) @IsOptional() environment?: string;
  @IsOptional() @IsString() accountId?: string;
  @IsOptional() @IsString() agencia?: string;
  @IsOptional() @IsString() conta?: string;
  @IsOptional() @IsString() convenio?: string;
  @IsOptional() @IsBoolean() isDefault?: boolean;
}

export class GenerateBoletoDto {
  @IsOptional() @IsString() financialEntryId?: string;
  @IsOptional() @IsString() contractId?: string;
  @IsOptional() @IsString() contactId?: string;
  @IsOptional() @IsString() gatewayId?: string;
  @IsNumber() @IsPositive() amount!: number;
  @IsDateString() dueDate!: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsNumber() fine?: number;
  @IsOptional() @IsNumber() interest?: number;
  @IsOptional() @IsNumber() discount?: number;
  @IsOptional() @IsString() instructions?: string;
}

export class BoletoQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(500) limit?: number = 20;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() contractId?: string;
}

export class UploadCnabDto {
  @IsEnum(['CNAB240','CNAB400']) format!: string;
  @IsEnum(['REMESSA','RETORNO']) type!: string;
  @IsString() filename!: string;
  @IsString() content!: string; // conteúdo base64 do arquivo
}

export class GenerateCnabRemessaDto {
  @IsOptional() @IsString() gatewayId?: string;
  @IsEnum(['CNAB240','CNAB400']) format!: string;
  @IsOptional() @IsString() period?: string; // YYYY-MM
}
