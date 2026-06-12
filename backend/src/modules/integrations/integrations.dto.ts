import { IsString, IsOptional, IsArray, IsDateString, IsUrl } from 'class-validator';

export class CreateApiKeyDto {
  @IsString() name!: string;
  @IsOptional() @IsArray() scopes?: string[];
  @IsOptional() @IsDateString() expiresAt?: string;
}

export class CreateWebhookDto {
  @IsUrl({ require_tld: false }) url!: string;
  @IsArray() events!: string[];
}

export class UpdateWebhookDto {
  @IsOptional() @IsUrl({ require_tld: false }) url?: string;
  @IsOptional() @IsArray() events?: string[];
  @IsOptional() @IsString() status?: string;
}
