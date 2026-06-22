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
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';

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

  @IsOptional()
  @IsNumber()
  saleValue?: number;

  @IsOptional()
  @IsString()
  paymentMethod?: string;

  @IsOptional()
  @IsNumber()
  commissionRate?: number;

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
