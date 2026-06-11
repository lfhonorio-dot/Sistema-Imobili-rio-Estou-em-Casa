// DTOs do Módulo de Split de Pagamento
import {
  IsString, IsOptional, IsEnum, IsNumber, IsBoolean,
  IsInt, Min, Max, IsPositive,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateRecipientDto {
  @IsString() name!: string;
  @IsString() document!: string; // CPF ou CNPJ
  @IsEnum(['CPF','CNPJ']) documentType!: string;
  @IsOptional() @IsString() email?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() bankCode?: string;
  @IsOptional() @IsString() agency?: string;
  @IsOptional() @IsString() accountNumber?: string;
  @IsOptional() @IsEnum(['CHECKING','SAVINGS']) accountType?: string;
  @IsOptional() @IsString() pixKey?: string;
  @IsOptional() @IsEnum(['CPF','CNPJ','EMAIL','PHONE','RANDOM']) pixKeyType?: string;
}

export class CreateSplitRuleDto {
  @IsString() contractId!: string;
  @IsString() recipientId!: string;
  @IsOptional() @IsEnum(['PERCENTAGE','FIXED']) type?: string;
  @IsNumber() @IsPositive() value!: number; // % ou valor fixo
  @IsOptional() @IsString() description?: string;
}

export class ProcessSplitDto {
  @IsString() financialEntryId!: string;
  @IsNumber() @IsPositive() totalAmount!: number;
}

export class SplitQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number = 20;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() recipientId?: string;
}
