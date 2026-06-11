// DTOs para Email
import { IsString, IsOptional, IsBoolean, IsArray, IsInt, Min, Max, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateEmailTemplateDto {
  @IsString()
  name!: string;

  @IsString()
  subject!: string;

  @IsString()
  body!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  variables?: string[];

  @IsEnum(['BOAS_VINDAS', 'PROPOSTA', 'CONTRATO', 'VISTORIA', 'MANUTENCAO', 'MARKETING', 'OUTRO'])
  category!: string;
}

export class UpdateEmailTemplateDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  subject?: string;

  @IsOptional()
  @IsString()
  body?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  variables?: string[];

  @IsOptional()
  @IsEnum(['BOAS_VINDAS', 'PROPOSTA', 'CONTRATO', 'VISTORIA', 'MANUTENCAO', 'MARKETING', 'OUTRO'])
  category?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class SendEmailDto {
  @IsString()
  to!: string;

  @IsOptional()
  @IsString()
  subject?: string;

  @IsOptional()
  @IsString()
  body?: string;

  @IsOptional()
  @IsString()
  templateId?: string;

  @IsOptional()
  variables?: Record<string, string>;

  @IsOptional()
  @IsString()
  contactId?: string;

  @IsOptional()
  @IsString()
  conversationId?: string;
}

export class EmailTemplateQueryDto {
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
  category?: string;
}
