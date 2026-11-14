import {
  IsArray, IsDateString, IsIn, IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

const emptyToUndefined = ({ value }: { value: unknown }) =>
  typeof value === 'string' && value.trim() === '' ? undefined : value;

// ── Visitas ─────────────────────────────────────────────────────────────

export class CreateVisitDto {
  @IsOptional() @Transform(emptyToUndefined) @IsString() dealId?: string;
  @IsOptional() @Transform(emptyToUndefined) @IsString() contactId?: string;
  @IsString() propertyId!: string;
  @IsOptional() @Transform(emptyToUndefined) @IsString() brokerId?: string;
  @IsDateString({}, { message: 'Data e hora da visita inválidas.' }) scheduledAt!: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(15) @Max(480) durationMin?: number;
  @IsOptional() @IsString() @MaxLength(2000) notes?: string;
}

export class RescheduleVisitDto {
  @IsDateString({}, { message: 'Nova data e hora inválidas.' }) scheduledAt!: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(15) @Max(480) durationMin?: number;
}

export const INTEREST_LEVELS = ['HIGH', 'MEDIUM', 'LOW', 'NONE'] as const;

export class CompleteVisitDto {
  @IsIn(INTEREST_LEVELS as unknown as string[], { message: 'Informe o interesse do cliente.' }) interestLevel!: string;
  @IsOptional() @IsString() @MaxLength(4000) feedback?: string;
}

export class CancelVisitDto {
  @IsString() @MaxLength(500) reason!: string;
  @IsOptional() @IsIn(['CANCELLED', 'NO_SHOW']) status?: 'CANCELLED' | 'NO_SHOW';
}

export class VisitQueryDto {
  @IsOptional() @IsDateString() from?: string;
  @IsOptional() @IsDateString() to?: string;
  @IsOptional() @IsIn(['SCHEDULED', 'DONE', 'CANCELLED', 'NO_SHOW']) status?: string;
  @IsOptional() @IsIn(['true', 'false']) mine?: 'true' | 'false';
  @IsOptional() @IsString() dealId?: string;
  @IsOptional() @IsString() propertyId?: string;
  @IsOptional() @IsString() contactId?: string;
}

// ── Propostas ───────────────────────────────────────────────────────────

export const PAYMENT_METHODS = ['CASH', 'FINANCING', 'FGTS', 'PERMUTA', 'MIXED'] as const;

export class ProposalTermsDto {
  @Type(() => Number) @IsNumber() @Min(0.01, { message: 'O valor da proposta deve ser maior que zero.' }) amount!: number;
  @IsIn(PAYMENT_METHODS as unknown as string[], { message: 'Forma de pagamento inválida.' }) paymentMethod!: string;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) downPayment?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) financedAmount?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) fgtsAmount?: number;
  @IsOptional() @IsString() @MaxLength(1000) exchangeDescription?: string;
  @IsOptional() @IsString() @MaxLength(4000) conditions?: string;
  @IsDateString({}, { message: 'Validade da proposta inválida.' }) validUntil!: string;
}

export class CreateProposalDto extends ProposalTermsDto {
  @IsString() dealId!: string;
  @IsOptional() @Transform(emptyToUndefined) @IsString() propertyId?: string;
}

export class DecideProposalDto {
  @IsOptional() @IsString() @MaxLength(1000) note?: string;
}

export class SetDealPropertiesDto {
  @IsArray() @IsString({ each: true }) propertyIds!: string[];
}
