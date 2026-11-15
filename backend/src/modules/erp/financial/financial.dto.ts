// DTOs para o módulo Financeiro

import {
  IsString,
  IsOptional,
  IsNumber,
  IsDateString,
  IsEnum,
  IsInt,
  Min,
  Max,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateFinancialEntryDto {
  @IsEnum(['RECEIVABLE', 'PAYABLE'])
  type!: string;

  // Fase 5: plano de categorias configurável (validado no serviço contra financial_categories)
  @IsString()
  category!: string;

  @IsString()
  description!: string;

  @IsNumber()
  amount!: number;

  @IsDateString()
  dueDate!: string;

  @IsOptional()
  @IsString()
  contractId?: string;

  @IsOptional()
  @IsString()
  propertyId?: string;

  @IsOptional()
  @IsString()
  contactId?: string;

  // Fase 2: fornecedor/favorecido (contas a pagar)
  @IsOptional()
  @IsString()
  supplierId?: string;

  // Fase 5: centro de custo
  @IsOptional()
  @IsString()
  costCenterId?: string;

  @IsOptional()
  @IsInt()
  installment?: number;

  @IsOptional()
  @IsInt()
  totalInstallments?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateFinancialEntryDto extends CreateFinancialEntryDto {}

export class PayEntryDto {
  @IsOptional()
  @IsDateString()
  paidAt?: string;

  @IsOptional()
  @IsNumber()
  paidAmount?: number;

  @IsOptional()
  @IsString()
  paymentMethod?: string;
}

export class ReceiveCommissionDto {
  @IsOptional()
  @IsNumber()
  receivedValue?: number;

  @IsOptional()
  @IsString()
  paymentMethod?: string; // PIX, TED, DINHEIRO, CHEQUE

  @IsOptional()
  @IsDateString()
  receivedAt?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class FinancialQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number = 20;

  @IsOptional()
  @IsString()
  type?: string;

  // Fase 4: filtrar por categoria (ex.: COMMISSION)
  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  contractId?: string;

  @IsOptional()
  @IsString()
  contactId?: string;

  @IsOptional()
  @IsString()
  dateFrom?: string;

  @IsOptional()
  @IsString()
  dateTo?: string;

  // Fase 5
  @IsOptional()
  @IsString()
  costCenterId?: string;

  @IsOptional()
  @IsString()
  search?: string;
}

export class CommissionQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number = 20;

  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  dateFrom?: string;

  @IsOptional()
  @IsString()
  dateTo?: string;
}

// ── Fase 5 ───────────────────────────────────────────────

export class RegisterPaymentDto {
  @IsOptional() @IsNumber() principal?: number;
  @IsOptional() @IsNumber() interest?: number;
  @IsOptional() @IsNumber() fine?: number;
  @IsOptional() @IsNumber() discount?: number;
  @IsOptional() @IsDateString() paidAt?: string;
  @IsOptional() @IsEnum(['PIX', 'TRANSFER', 'CASH', 'BOLETO', 'CARD', 'CHECK', 'OTHER']) method?: string;
  @IsOptional() @IsString() bankAccountId?: string;
  @IsOptional() @IsString() receiptFileId?: string;
  @IsOptional() @IsString() notes?: string;
}

export class ReasonDto {
  @IsString() reason!: string;
}

export class CategoryDto {
  @IsEnum(['RECEIVABLE', 'PAYABLE']) type!: string;
  @IsString() name!: string;
}

export class UpdateCategoryDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class CostCenterDto {
  @IsString() name!: string;
}

export class UpdateCostCenterDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class FinancialSettingsDto {
  @IsOptional() @IsNumber() finePct?: number;
  @IsOptional() @IsNumber() interestMonthlyPct?: number;
}

export class RecurringDto {
  @IsEnum(['RECEIVABLE', 'PAYABLE']) type!: string;
  @IsString() category!: string;
  @IsString() description!: string;
  @IsNumber() amount!: number;
  @IsInt() @Min(1) @Max(28) dayOfMonth!: number;
  @IsDateString() startDate!: string;
  @IsOptional() @IsDateString() endDate?: string;
  @IsOptional() @IsString() contactId?: string;
  @IsOptional() @IsString() supplierId?: string;
  @IsOptional() @IsString() costCenterId?: string;
  @IsOptional() @IsString() propertyId?: string;
  @IsOptional() @IsString() notes?: string;
}

export class UpdateRecurringDto {
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsNumber() amount?: number;
  @IsOptional() @IsInt() @Min(1) @Max(28) dayOfMonth?: number;
  @IsOptional() @IsDateString() endDate?: string;
  @IsOptional() @IsString() costCenterId?: string;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class CashFlowQueryDto {
  @IsOptional() @IsDateString() from?: string;
  @IsOptional() @IsDateString() to?: string;
  @IsOptional() @IsEnum(['day', 'month']) granularity?: 'day' | 'month';
  @IsOptional() @IsString() bankAccountId?: string;
}

export class DreQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() year?: number;
}
