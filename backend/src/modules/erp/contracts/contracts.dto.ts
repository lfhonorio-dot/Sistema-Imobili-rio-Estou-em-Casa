// DTOs para o módulo de Contratos

import {
  IsString,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsDateString,
  IsArray,
  IsEnum,
  IsInt,
  IsIn,
  Min,
  Max,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

// Repasse de parte da comissão para um corretor parceiro (% da comissão)
export class PartnerSplitDto {
  @IsString()
  contactId!: string;

  @IsNumber()
  @Min(0)
  @Max(100)
  percentage!: number; // % da COMISSÃO destinado a este parceiro

  @IsOptional()
  @IsString()
  note?: string;
}

export enum ContractType {
  SALE = 'SALE',
  RENTAL_RESIDENTIAL = 'RENTAL_RESIDENTIAL',
  RENTAL_COMMERCIAL = 'RENTAL_COMMERCIAL',
  BROKERAGE = 'BROKERAGE',
}

export enum ContractStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  TERMINATED = 'TERMINATED',
  RESCINDED = 'RESCINDED',
}

export class CreateContractDto {
  @IsEnum(ContractType)
  type!: ContractType;

  @IsString()
  propertyId!: string;

  @IsOptional()
  @IsString()
  ownerId?: string;

  @IsOptional()
  @IsString()
  tenantId?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  guarantorIds?: string[];

  // Garantia locatícia (art. 37 da Lei 8.245/91) — modalidades não cumuláveis
  @IsOptional()
  @IsIn(['FIADOR', 'CAUCAO', 'SEGURO_FIANCA', 'TITULO_CAPITALIZACAO', 'NONE'])
  guaranteeType?: string;

  @IsOptional()
  @IsNumber()
  guaranteeValue?: number;

  @IsOptional()
  @IsString()
  guaranteeDetails?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsDateString()
  signedAt?: string;

  @IsOptional()
  @IsNumber()
  rentalValue?: number;

  @IsOptional()
  @IsString()
  adjustmentIndex?: string;

  @IsOptional()
  @IsInt()
  adjustmentMonth?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(31)
  dueDay?: number;

  @IsOptional()
  @IsNumber()
  lateFee?: number;

  @IsOptional()
  @IsNumber()
  punctualDiscount?: number;

  @IsOptional()
  @IsBoolean()
  includesWater?: boolean;

  @IsOptional()
  @IsBoolean()
  includesElec?: boolean;

  @IsOptional()
  @IsBoolean()
  includesCondo?: boolean;

  @IsOptional()
  @IsBoolean()
  includesIptu?: boolean;

  @IsOptional()
  @IsString()
  customClauses?: string;

  // Modelo do documento gerado: RENTAL_WAREHOUSE (barracão/galpão) ou
  // RENTAL_COMMERCIAL_ROOM (sala comercial com fiadores). Vazio = automático.
  @IsOptional()
  @IsIn(['RENTAL_WAREHOUSE', 'RENTAL_COMMERCIAL_ROOM'])
  templateKey?: string;

  @IsOptional()
  @IsNumber()
  saleValue?: number;

  @IsOptional()
  @IsString()
  paymentMethod?: string;

  @IsOptional()
  @IsNumber()
  commissionRate?: number;

  // Corretores parceiros que recebem repasse de parte da comissão
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PartnerSplitDto)
  partnerSplits?: PartnerSplitDto[];

  @IsOptional()
  @IsDateString()
  proposalDate?: string;

  @IsOptional()
  @IsDateString()
  acceptanceDate?: string;

  @IsOptional()
  @IsDateString()
  deedDate?: string;

  @IsOptional()
  @IsDateString()
  keyDeliveryDate?: string;

  @IsOptional()
  @IsString()
  signedFileUrl?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateContractDto extends CreateContractDto {}

export class ChangeContractStatusDto {
  @IsEnum(ContractStatus)
  status!: ContractStatus;
}

export class GenerateInstallmentsDto {
  @IsInt()
  @Min(1)
  @Max(120)
  months!: number;
}

export class ContractQueryDto {
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

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  propertyId?: string;

  @IsOptional()
  @IsString()
  contactId?: string;

  @IsOptional()
  @IsString()
  search?: string;
}

export class SignatoryInputDto {
  @IsString()
  name!: string;

  @IsString()
  email!: string;

  @IsString()
  role!: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  cpf?: string;
}

export class RequestSignatureDto {
  @IsOptional()
  @IsString()
  documentUrl?: string;

  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @IsString()
  deadline?: string;

  @IsOptional()
  @IsString()
  message?: string;

  @IsOptional()
  @IsArray()
  additionalSignatories?: SignatoryInputDto[];
}
