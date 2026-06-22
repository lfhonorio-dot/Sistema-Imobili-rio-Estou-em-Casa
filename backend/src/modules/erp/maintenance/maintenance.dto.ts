// DTOs para o módulo de Manutenção

import { IsString, IsOptional, IsNumber, IsDateString, IsEnum, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateMaintenanceOrderDto {
  @IsString()
  propertyId!: string;

  @IsOptional()
  @IsString()
  contractId?: string;

  @IsEnum(['ELECTRICAL', 'PLUMBING', 'STRUCTURAL', 'PAINTING', 'LOCKSMITH', 'OTHER'])
  type!: string;

  @IsEnum(['URGENT', 'HIGH', 'MEDIUM', 'LOW'])
  priority!: string;

  @IsEnum(['OWNER', 'TENANT', 'BROKER', 'AGENCY'])
  requestedBy!: string;

  @IsString()
  title!: string;

  @IsString()
  description!: string;

  @IsOptional()
  @IsString()
  assigneeId?: string;

  @IsOptional()
  @IsString()
  supplierName?: string;

  @IsOptional()
  @IsNumber()
  quotedAmount?: number;

  @IsOptional()
  @IsNumber()
  finalAmount?: number;

  @IsOptional()
  @IsString()
  paidBy?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateMaintenanceOrderDto extends CreateMaintenanceOrderDto {}

export class ChangeMaintenanceStatusDto {
  @IsEnum(['OPEN', 'IN_PROGRESS', 'AWAITING_QUOTE', 'COMPLETED', 'CANCELLED'])
  status!: string;

  @IsOptional()
  @IsString()
  supplierName?: string;

  @IsOptional()
  @IsNumber()
  quotedAmount?: number;

  @IsOptional()
  @IsNumber()
  finalAmount?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class MaintenanceQueryDto {
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
  status?: string;

  @IsOptional()
  @IsString()
  priority?: string;

  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @IsString()
  propertyId?: string;
}
