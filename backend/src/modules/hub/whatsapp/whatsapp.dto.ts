// DTOs para WhatsApp
import { IsString, IsOptional, IsEnum } from 'class-validator';

export class SaveWhatsAppConfigDto {
  @IsString()
  phoneNumberId!: string;

  @IsString()
  accessToken!: string;

  @IsString()
  webhookSecret!: string;

  @IsOptional()
  @IsString()
  businessAccountId?: string;
}

export class SendWhatsAppMessageDto {
  @IsString()
  to!: string;

  @IsEnum(['TEXT', 'IMAGE', 'DOCUMENT', 'AUDIO', 'VIDEO', 'TEMPLATE'])
  type!: string;

  @IsOptional()
  @IsString()
  body?: string;

  @IsOptional()
  @IsString()
  mediaUrl?: string;

  @IsOptional()
  @IsString()
  templateName?: string;

  @IsOptional()
  variables?: Record<string, string>;

  @IsOptional()
  @IsString()
  conversationId?: string;

  @IsOptional()
  @IsString()
  contactId?: string;
}
