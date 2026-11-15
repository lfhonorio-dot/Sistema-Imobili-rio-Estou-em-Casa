import { IsBoolean, IsEmail, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { Transform, Type } from 'class-transformer';

const emptyToUndefined = ({ value }: { value: unknown }) =>
  typeof value === 'string' && value.trim() === '' ? undefined : value;

export const SUPPLIER_CATEGORIES = [
  'CARTORIO', 'PUBLICIDADE', 'MANUTENCAO', 'SERVICOS', 'CORRETOR', 'IMPOSTOS', 'ALUGUEL', 'OUTRO',
] as const;

export class CreateSupplierDto {
  @IsString() @MaxLength(200) name!: string;
  @IsOptional() @IsIn(['PF', 'PJ']) personType?: string;
  @IsOptional() @Transform(emptyToUndefined) @IsString() @MaxLength(20) document?: string;
  @IsOptional() @Transform(emptyToUndefined) @IsEmail({}, { message: 'E-mail inválido.' }) email?: string;
  @IsOptional() @Transform(emptyToUndefined) @IsString() @MaxLength(30) phone?: string;
  @IsOptional() @Transform(emptyToUndefined) @IsIn(SUPPLIER_CATEGORIES as unknown as string[]) category?: string;
  @IsOptional() @Transform(emptyToUndefined) @IsIn(['CPF', 'CNPJ', 'EMAIL', 'PHONE', 'RANDOM']) pixKeyType?: string;
  @IsOptional() @Transform(emptyToUndefined) @IsString() @MaxLength(100) pixKey?: string;
  @IsOptional() @Transform(emptyToUndefined) @IsString() @MaxLength(10) bankCode?: string;
  @IsOptional() @Transform(emptyToUndefined) @IsString() @MaxLength(10) agency?: string;
  @IsOptional() @Transform(emptyToUndefined) @IsString() @MaxLength(20) accountNumber?: string;
  @IsOptional() @IsString() @MaxLength(2000) notes?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class UpdateSupplierDto extends CreateSupplierDto {
  @IsOptional() @IsString() @MaxLength(200) declare name: string;
}

export class SupplierQueryDto {
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsString() category?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(500) limit?: number;
}
