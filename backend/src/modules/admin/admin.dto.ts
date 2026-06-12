import { IsString, IsBoolean, IsOptional, IsArray, IsInt } from 'class-validator';

export class SetPlatformConfigDto {
  @IsString() key!: string;
  @IsString() value!: string;
  @IsOptional() @IsString() description?: string;
}

export class SetFeatureFlagDto {
  @IsString() key!: string;
  @IsBoolean() enabled!: boolean;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsArray() workspaceIds?: string[];
}

export class SetWorkspacePlanDto {
  @IsString() plan!: string;
  @IsOptional() @IsInt() maxUsers?: number;
  @IsOptional() @IsInt() maxProperties?: number;
  @IsOptional() @IsInt() maxContacts?: number;
  @IsOptional() @IsArray() features?: string[];
}

export class CompleteOnboardingStepDto {
  @IsString() step!: string;
}
