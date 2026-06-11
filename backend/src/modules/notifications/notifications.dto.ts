import { IsString, IsOptional, IsBoolean, IsArray } from 'class-validator';

export class UpdateNotificationPreferenceDto {
  @IsString() type!: string;
  @IsOptional() @IsBoolean() inApp?: boolean;
  @IsOptional() @IsBoolean() email?: boolean;
  @IsOptional() @IsBoolean() push?: boolean;
}

export class CreateInAppNotificationDto {
  @IsString() title!: string;
  @IsString() body!: string;
  @IsOptional() @IsString() type?: string;
  @IsOptional() @IsString() entityId?: string;
  @IsOptional() @IsString() entityType?: string;
  @IsOptional() @IsArray() userIds?: string[];
}
