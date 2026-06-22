// DTOs do Módulo Bancário (Contas, OFX, Conciliação, Open Finance)
import {
  IsString, IsOptional, IsEnum, IsNumber, IsBoolean,
  IsDateString, IsInt, Min, Max, IsPositive,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateBankAccountDto {
  @IsString() name!: string;
  @IsOptional() @IsString() bankCode?: string;
  @IsOptional() @IsString() bankName?: string;
  @IsOptional() @IsString() agency?: string;
  @IsOptional() @IsString() accountNumber?: string;
  @IsOptional() @IsEnum(['CHECKING','SAVINGS','PAYMENT']) accountType?: string;
  @IsOptional() @IsString() pixKey?: string;
  @IsOptional() @IsBoolean() isDefault?: boolean;
}

export class ImportOfxDto {
  @IsString() bankAccountId!: string;
  @IsString() content!: string; // conteúdo base64 do arquivo OFX
}

export class BankTransactionQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(500) limit?: number = 20;
  @IsOptional() @IsString() bankAccountId?: string;
  @IsOptional() @IsBoolean() reconciled?: boolean;
  @IsOptional() @IsDateString() startDate?: string;
  @IsOptional() @IsDateString() endDate?: string;
}

export class ReconcileDto {
  @IsString() bankTransactionId!: string;
  @IsOptional() @IsString() financialEntryId?: string;
  @IsOptional() @IsString() notes?: string;
}

export class ManualTransactionDto {
  @IsString() bankAccountId!: string;
  @IsNumber() amount!: number; // positivo=crédito, negativo=débito
  @IsDateString() date!: string;
  @IsString() description!: string;
  @IsOptional() @IsString() type?: string;
  @IsOptional() @IsString() financialEntryId?: string;
}
