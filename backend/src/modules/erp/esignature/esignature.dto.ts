// DTOs de Assinatura Eletrônica
import {
  IsString, IsOptional, IsEnum, IsArray, IsEmail, IsDateString,
  IsInt, Min, Max, ValidateNested, IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';

export class SignatoryInputDto {
  @IsString() name!: string;
  @IsEmail() email!: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() cpf?: string;
  @IsEnum(['LOCATARIO','LOCADOR','FIADOR','IMOBILIARIA','TESTEMUNHA']) role!: string;
  @IsOptional() @IsInt() @Min(0) order?: number;
}

export class CreateEnvelopeDto {
  @IsString() title!: string;
  @IsString() documentUrl!: string;
  @IsOptional() @IsString() contractId?: string;
  @IsEnum(['SIMPLE','ADVANCED','QUALIFIED']) @IsOptional() type?: string;
  @IsEnum(['PARALLEL','SEQUENTIAL']) @IsOptional() order?: string;
  @IsOptional() @IsDateString() deadline?: string;
  @IsOptional() @IsString() message?: string;
  @IsArray() @ValidateNested({ each: true }) @Type(() => SignatoryInputDto)
  signatories!: SignatoryInputDto[];
}

export class EnvelopeQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number = 20;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() contractId?: string;
}

export class ValidateOtpDto {
  @IsString() otp!: string;
  @IsOptional() @IsString() cpf?: string;
  @IsOptional() latitude?: number;
  @IsOptional() longitude?: number;
}

export class RejectSignatureDto {
  @IsString() reason!: string;
}
