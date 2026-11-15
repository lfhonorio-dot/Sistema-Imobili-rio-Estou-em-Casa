// DTOs do módulo de workspace

import {
  IsString,
  IsOptional,
  IsBoolean,
  IsEmail,
  MaxLength,
  Matches,
  IsObject,
  IsIn,
} from 'class-validator';
import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { EmptyToNull } from '../../common/transforms/empty-to-null';
import { OPERATION_PROFILES, OperationProfile } from '../../common/decorators/operation-profile.decorator';

// DTO para atualizar configurações do workspace
export class UpdateWorkspaceDto {
  @ApiPropertyOptional({ description: 'Nome da imobiliária' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @ApiPropertyOptional({ description: 'CNPJ da empresa' })
  @EmptyToNull()
  @IsOptional()
  @IsString()
  cnpj?: string | null;

  @ApiPropertyOptional({ description: 'Endereço completo' })
  @EmptyToNull()
  @IsOptional()
  @IsString()
  address?: string | null;

  @ApiPropertyOptional({ description: 'Telefone de contato' })
  @EmptyToNull()
  @IsOptional()
  @IsString()
  phone?: string | null;

  @ApiPropertyOptional({ description: 'Fuso horário (ex: America/Sao_Paulo)' })
  @IsOptional()
  @IsString()
  timezone?: string;

  @ApiPropertyOptional({ description: 'Nome do DPO (Encarregado de Dados)' })
  @EmptyToNull()
  @IsOptional()
  @IsString()
  dpoName?: string | null;

  @ApiPropertyOptional({ description: 'E-mail do DPO' })
  @EmptyToNull()
  @IsOptional()
  @IsEmail({}, { message: 'E-mail do DPO inválido.' })
  dpoEmail?: string | null;

  @ApiPropertyOptional({ description: 'Exigir 2FA para todos os membros' })
  @IsOptional()
  @IsBoolean()
  twoFactorRequired?: boolean;

  @ApiPropertyOptional({
    description: 'Perfil de operação: VENDA (padrão) ou VENDA_E_LOCACAO',
    enum: OPERATION_PROFILES,
  })
  @IsOptional()
  @IsIn(OPERATION_PROFILES as unknown as string[], {
    message: 'Perfil de operação inválido. Use VENDA ou VENDA_E_LOCACAO.',
  })
  operationProfile?: OperationProfile;
}

// DTO para criar papel no workspace
export class CreateRoleDto {
  @ApiProperty({ description: 'Nome do papel' })
  @IsString()
  @MaxLength(100)
  name!: string;

  @ApiPropertyOptional({ description: 'Permissões do papel (objeto JSON)' })
  @IsOptional()
  @IsObject()
  permissions?: Record<string, boolean>;
}

// DTO para atualizar papel
export class UpdateRoleDto {
  @ApiPropertyOptional({ description: 'Nome do papel' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ description: 'Permissões do papel' })
  @IsOptional()
  @IsObject()
  permissions?: Record<string, boolean>;
}
