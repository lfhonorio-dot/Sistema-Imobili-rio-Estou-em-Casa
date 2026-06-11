import { IsString, IsOptional, IsObject } from 'class-validator';

export class SaveMetaIntegrationDto {
  @IsString() accessToken!: string;
  @IsString() accountId!: string;
  @IsOptional() @IsString() pageId?: string;
}

export class FieldMappingDto {
  @IsObject() mappings!: Record<string, string>;
}

export class CapiEventDto {
  @IsString() eventType!: string;
  @IsOptional() @IsObject() payload?: Record<string, unknown>;
}
