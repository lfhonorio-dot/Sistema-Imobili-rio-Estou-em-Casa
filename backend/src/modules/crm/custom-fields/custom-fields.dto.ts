// DTOs para o módulo de Campos Personalizados
import {
  IsString,
  IsOptional,
  IsBoolean,
  IsNumber,
  IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';

const MODULES = ['CONTACT', 'DEAL', 'PROPERTY'] as const;
const FIELD_TYPES = ['TEXT', 'NUMBER', 'DATE', 'SELECT', 'MULTISELECT', 'URL', 'FILE'] as const;

export class CreateCustomFieldDto {
  @IsIn(MODULES)
  module!: string;

  @IsString()
  name!: string;

  @IsString()
  key!: string;

  @IsIn(FIELD_TYPES)
  type!: string;

  @IsOptional()
  options?: unknown;

  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  order?: number;
}

export class UpdateCustomFieldDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  options?: unknown;

  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  order?: number;
}

export class CustomFieldQueryDto {
  @IsOptional()
  @IsIn(MODULES)
  module?: string;
}
