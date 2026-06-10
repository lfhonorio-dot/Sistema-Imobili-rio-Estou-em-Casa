// DTOs para o módulo de Vistorias

import { IsString, IsOptional, IsDateString, IsEnum, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateInspectionDto {
  @IsEnum(['ENTRY', 'EXIT'])
  type!: string;

  @IsString()
  propertyId!: string;

  @IsOptional()
  @IsString()
  contractId?: string;

  @IsOptional()
  @IsDateString()
  scheduledAt?: string;

  @IsOptional()
  @IsDateString()
  doneAt?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  reportUrl?: string;
}

export class UpdateInspectionDto extends CreateInspectionDto {}

export class AddRoomDto {
  @IsString()
  name!: string;

  items?: Array<{
    name: string;
    condition: string;
    notes?: string;
    photoUrls?: string[];
  }>;
}

export class InspectionQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @IsString()
  propertyId?: string;

  @IsOptional()
  @IsString()
  contractId?: string;
}
