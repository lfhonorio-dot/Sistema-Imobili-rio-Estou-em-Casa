import { IsString, IsOptional, IsObject, IsNumber } from 'class-validator';

export class SaveGoogleIntegrationDto {
  @IsString() accessToken!: string;
  @IsString() customerId!: string;
}

export class OfflineConversionDto {
  @IsOptional() @IsString() gclid?: string;
  @IsOptional() @IsNumber() value?: number;
  @IsOptional() @IsString() conversionName?: string;
}
