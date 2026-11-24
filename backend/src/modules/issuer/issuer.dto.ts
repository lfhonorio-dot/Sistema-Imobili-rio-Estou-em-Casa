import { IsBoolean, IsIn, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class ChangeIdentityDto {
  @IsString() @MaxLength(20) cnpj!: string;
  @IsString() @MaxLength(200) razaoSocial!: string;
  @IsOptional() @IsString() @MaxLength(200) nomeFantasia?: string;
  @IsOptional() @IsString() @MaxLength(50) inscricaoMunicipal?: string;
  @IsOptional() @IsString() @MaxLength(500) endereco?: string;
  @IsOptional() @IsString() @MaxLength(40) regimeTributario?: string;
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Data de início no formato AAAA-MM-DD.' }) validFrom!: string;
}

export class ChecklistItemDto {
  @IsIn(['bankAccounts', 'whatsapp', 'contractTemplates']) key!: string;
  @IsBoolean() done!: boolean;
}
