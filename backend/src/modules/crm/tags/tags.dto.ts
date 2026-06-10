// DTOs para o módulo de Tags
import { IsString, IsOptional, IsIn } from 'class-validator';

const MODULES = ['CONTACT', 'DEAL', 'PROPERTY'] as const;

export class CreateTagDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  color?: string;

  @IsIn(MODULES)
  module!: string;
}

export class UpdateTagDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  color?: string;
}

export class TagQueryDto {
  @IsOptional()
  @IsIn(MODULES)
  module?: string;
}
