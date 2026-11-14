// DTOs do Módulo Bancário (Contas, OFX, Conciliação, Open Finance)
import {
  IsString, IsOptional, IsEnum, IsNumber, IsBoolean,
  IsDateString, IsInt, Min, Max, IsPositive, IsIn,
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
  // Fase 5: saldo inicial (para fluxo de caixa e razão bancário)
  @IsOptional() @IsNumber() openingBalance?: number;
  @IsOptional() @IsDateString() openingDate?: string;
}

export class ImportOfxDto {
  @IsString() bankAccountId!: string;
  @IsString() content!: string; // conteúdo base64 do arquivo OFX
}

export class BankTransactionQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(500) limit?: number = 20;
  @IsOptional() @IsString() bankAccountId?: string;
  @IsOptional() @IsIn(['true', 'false', '']) reconciled?: string;
  @IsOptional() @IsDateString() startDate?: string;
  @IsOptional() @IsDateString() endDate?: string;
}

export class ReconcileDto {
  @IsString() bankTransactionId!: string;
  @IsOptional() @IsString() financialEntryId?: string;
  // Fase 5: ligar a uma baixa já existente (ex.: boleto baixado pelo webhook)
  @IsOptional() @IsString() paymentId?: string;
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

// ── Fase 5 ───────────────────────────────────────────────
export class ImportStatementDto {
  @IsString() bankAccountId!: string;
  @IsString() content!: string; // base64
  @IsOptional() @IsString() fileName?: string; // .ofx, .csv ou .xlsx
}

export class LedgerQueryDto {
  @IsOptional() @IsDateString() from?: string;
  @IsOptional() @IsDateString() to?: string;
}
