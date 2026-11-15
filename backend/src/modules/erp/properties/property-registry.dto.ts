import {
  IsBoolean, IsDateString, IsIn, IsNumber, IsOptional, IsString, Max, MaxLength, Min,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

const emptyToUndefined = ({ value }: { value: unknown }) =>
  typeof value === 'string' && value.trim() === '' ? undefined : value;

export class AddOwnerDto {
  @IsString() contactId!: string;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0.01) @Max(100) sharePct?: number;
  @IsOptional() @IsBoolean() isPrimary?: boolean;
}

export class CreateAuthorizationDto {
  @IsDateString({}, { message: 'Data de assinatura inválida.' }) signedAt!: string;
  @IsDateString({}, { message: 'Data de validade inválida.' }) validUntil!: string;
  @IsOptional() @IsBoolean() exclusive?: boolean;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(100) commissionRate?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) askingPrice?: number;
  @IsOptional() @Transform(emptyToUndefined) @IsString() captorUserId?: string;
  @IsOptional() @Transform(emptyToUndefined) @IsString() documentId?: string;
  @IsOptional() @IsString() @MaxLength(2000) notes?: string;
}

export class CancelAuthorizationDto {
  @IsString() @MaxLength(500) reason!: string;
}

export class KeyMovementDto {
  @IsIn(['CHECKOUT', 'RETURN']) action!: 'CHECKOUT' | 'RETURN';
  @IsOptional() @IsString() @MaxLength(120) keyLabel?: string;
  @IsOptional() @IsString() @MaxLength(200) holderName?: string;
  @IsOptional() @Transform(emptyToUndefined) @IsString() holderContactId?: string;
  @IsOptional() @Transform(emptyToUndefined) @IsDateString() expectedReturnAt?: string;
  @IsOptional() @IsString() @MaxLength(1000) notes?: string;
}

export const PROPERTY_DOCUMENT_TYPES = [
  'MATRICULA', 'IPTU', 'CERTIDAO', 'AUTORIZACAO_VENDA', 'PLANTA', 'HABITE_SE', 'ESCRITURA', 'OUTRO',
] as const;

export class UploadDocumentDto {
  @IsIn(PROPERTY_DOCUMENT_TYPES as unknown as string[], { message: 'Tipo de documento inválido.' }) type!: string;
  @IsOptional() @IsString() @MaxLength(200) name?: string;
  @IsOptional() @Transform(emptyToUndefined) @IsDateString() expiresAt?: string;
  @IsOptional() @IsString() @MaxLength(1000) notes?: string;
}

export class UploadPhotoDto {
  @IsOptional() @IsString() @MaxLength(200) caption?: string;
}
