// DTOs para o módulo de Pipelines
import {
  IsString,
  IsOptional,
  IsBoolean,
  IsNumber,
  IsIn,
  IsHexColor,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

const PIPELINE_TYPES = ['SALE', 'RENTAL', 'COMMERCIAL', 'CUSTOM'] as const;

export class CreatePipelineDto {
  @IsString()
  name!: string;

  @IsIn(PIPELINE_TYPES)
  type!: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  order?: number;
}

export class UpdatePipelineDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsIn(PIPELINE_TYPES)
  type?: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class CreateStageDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  color?: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  order!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  expectedDays?: number;

  @IsOptional()
  @IsBoolean()
  isWon?: boolean;

  @IsOptional()
  @IsBoolean()
  isLost?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  rottenAfterDays?: number;
}

export class UpdateStageDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  color?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  expectedDays?: number;

  @IsOptional()
  @IsBoolean()
  isWon?: boolean;

  @IsOptional()
  @IsBoolean()
  isLost?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  rottenAfterDays?: number;
}

export class ReorderStagesDto {
  @IsString({ each: true })
  stageIds!: string[];
}
