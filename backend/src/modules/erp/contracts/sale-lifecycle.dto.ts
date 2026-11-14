import {
  ArrayMaxSize, IsArray, IsBoolean, IsDateString, IsIn, IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min,
  ValidateNested,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

const emptyToUndefined = ({ value }: { value: unknown }) =>
  typeof value === 'string' && value.trim() === '' ? undefined : value;

export class InstallmentDto {
  @IsDateString({}, { message: 'Data de vencimento da parcela inválida.' }) dueDate!: string;
  @Type(() => Number) @IsNumber() @Min(0.01) amount!: number;
}

export class ActivateSaleDto {
  /** Comissão total da imobiliária. Padrão: valor da venda × taxa do contrato. */
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0.01) commissionAmount?: number;
  /** Quem paga a comissão (contato). Padrão: o vendedor (proprietário). */
  @IsOptional() @Transform(emptyToUndefined) @IsString() commissionPayerId?: string;

  /** Parcelas explícitas OU quantidade + primeiro vencimento (mensais iguais). */
  @IsOptional() @IsArray() @ArrayMaxSize(60) @ValidateNested({ each: true }) @Type(() => InstallmentDto)
  installments?: InstallmentDto[];
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(60) installmentsCount?: number;
  @IsOptional() @Transform(emptyToUndefined) @IsDateString() firstDueDate?: string;

  @IsOptional() @Transform(emptyToUndefined) @IsString() sellerBrokerId?: string;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(100) sellerBrokerPct?: number;
  @IsOptional() @Transform(emptyToUndefined) @IsString() captorBrokerId?: string;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(100) captorBrokerPct?: number;

  /** Forma de pagamento da operação (do comprador ao vendedor). */
  @IsOptional() @IsIn(['CASH', 'FINANCING', 'FGTS', 'PERMUTA', 'MIXED']) paymentMethod?: string;
  /** Pagamento (total ou parcial) em dinheiro vivo. */
  @IsOptional() @IsBoolean() cashInvolved?: boolean;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) cashAmount?: number;

  /** Data do evento para a DIMOB (assinatura). Padrão: data de assinatura ou hoje. */
  @IsOptional() @Transform(emptyToUndefined) @IsDateString() eventDate?: string;
}

export class RescindSaleDto {
  @IsString() @MaxLength(1000) reason!: string;
}

export class CashReviewDto {
  @IsString() @MaxLength(2000) note!: string;
}

export class UpdateChecklistItemDto {
  @IsOptional() @IsIn(['PENDING', 'DONE', 'NOT_APPLICABLE']) status?: string;
  @IsOptional() @IsString() responsibleId?: string | null;
  @IsOptional() @IsDateString() dueDate?: string | null;
  @IsOptional() @IsString() @MaxLength(2000) notes?: string | null;
}

export class AddChecklistItemDto {
  @IsString() @MaxLength(200) title!: string;
  @IsOptional() @Transform(emptyToUndefined) @IsString() responsibleId?: string;
  @IsOptional() @Transform(emptyToUndefined) @IsDateString() dueDate?: string;
}
